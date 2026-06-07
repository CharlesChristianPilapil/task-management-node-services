import type { AuthenticatedUser } from "../types/auth.d.js";
import type {
    AnalyticsDateRange,
    MemberProductivity,
    MemberUpcomingDeadlines,
    TaskSummary,
    TeamProductivityReport,
    UpcomingDeadlinesReport,
} from "../types/analytics.d.js";
import type { Task } from "../types/task.d.js";
import { AppError } from "../utils/app-error.util.js";
import { cacheService } from "./cache.service.js";
import { laravelApiService } from "./laravel-api.service.js";

const COMPLETED_STATUS = "completed";
const PENDING_STATUSES = new Set(["pending", "in_progress"]);
const UPCOMING_DEADLINE_DAYS = 7;
const UPCOMING_DEADLINE_MS = UPCOMING_DEADLINE_DAYS * 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 3_600_000;
const TASK_SUMMARY_CACHE_TTL_MS = 300_000;
const TEAM_PRODUCTIVITY_CACHE_TTL_MS = 300_000;
const UPCOMING_DEADLINES_CACHE_TTL_MS = 60_000;

const buildCacheKey = (prefix: string, parts: Record<string, string | number | undefined>): string => {
    const normalized = Object.entries(parts)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value ?? ""}`)
        .join("|");

    return `${prefix}:${normalized}`;
};

const parsePositiveInt = (value: unknown, field: string): number => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new AppError(`${field} is required and must be a positive integer.`, 422);
    }

    return parsed;
};

const parseOptionalDate = (value: unknown, field: string): string | undefined => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    if (typeof value !== "string") {
        throw new AppError(`Invalid ${field}. Expected an ISO date string.`, 422);
    }

    const timestamp = Date.parse(value);

    if (Number.isNaN(timestamp)) {
        throw new AppError(`Invalid ${field}. Expected an ISO date string.`, 422);
    }

    return new Date(timestamp).toISOString();
};

const parseTaskDate = (value: string | null | undefined): Date | null => {
    if (!value) {
        return null;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : new Date(timestamp);
};

const resolveMemberName = (userId: number | null, memberNames: Map<number, string>): string => {
    if (userId === null) return "Unassigned";
    return memberNames.get(userId) ?? `User #${userId}`;
};

const groupTasksByAssignee = (tasks: Task[]): Map<number | null, Task[]> => {
    const grouped = new Map<number | null, Task[]>();

    for (const task of tasks) {
        const bucket = grouped.get(task.assigned_to) ?? [];
        bucket.push(task);
        grouped.set(task.assigned_to, bucket);
    }

    return grouped;
};

const isWithinDateRange = (task: Task, range: AnalyticsDateRange): boolean => {
    const createdAt = parseTaskDate(task.created_at);

    if (!createdAt) {
        return true;
    }

    if (range.dateFrom) {
        const from = Date.parse(range.dateFrom);

        if (!Number.isNaN(from) && createdAt.getTime() < from) {
            return false;
        }
    }

    if (range.dateTo) {
        const to = Date.parse(range.dateTo);

        if (!Number.isNaN(to) && createdAt.getTime() > to) {
            return false;
        }
    }

    return true;
};

const calculateCompletionHours = (task: Task): number | null => {
    const createdAt = parseTaskDate(task.created_at);
    const updatedAt = parseTaskDate(task.updated_at);

    if (!createdAt || !updatedAt || updatedAt.getTime() < createdAt.getTime()) {
        return null;
    }

    return Number(((updatedAt.getTime() - createdAt.getTime()) / MS_PER_HOUR).toFixed(2));
};

const averageCompletionHours = (tasks: Task[]): number | null => {
    const durations = tasks
        .map((task) => calculateCompletionHours(task))
        .filter((value): value is number => value !== null);

    if (durations.length === 0) {
        return null;
    }

    const total = durations.reduce((sum, value) => sum + value, 0);
    return Number((total / durations.length).toFixed(2));
};

const buildTaskSummary = (tasks: Task[]): TaskSummary => {
    const completedTasks = tasks.filter((task) => task.status === COMPLETED_STATUS);
    const pendingTasks = tasks.filter((task) => PENDING_STATUSES.has(task.status));

    return {
        total_tasks: tasks.length,
        completed_tasks: completedTasks.length,
        pending_tasks: pendingTasks.length,
        avg_completion_time: averageCompletionHours(completedTasks),
    };
};

const buildTeamProductivity = (tasks: Task[], memberNames: Map<number, string>): TeamProductivityReport["members"] => {
    const grouped = groupTasksByAssignee(tasks);
    const members: MemberProductivity[] = [];

    for (const [userId, memberTasks] of grouped.entries()) {
        const completedTasks = memberTasks.filter((task) => task.status === COMPLETED_STATUS);
        const taskCount = memberTasks.length;
        const completedCount = completedTasks.length;

        members.push({
            user_id: userId,
            name: resolveMemberName(userId, memberNames),
            task_count: taskCount,
            completed_count: completedCount,
            completion_rate: taskCount === 0 ? 0 : Number((completedCount / taskCount).toFixed(2)),
            avg_completion_time: averageCompletionHours(completedTasks),
        });
    }

    return members.sort((left, right) => left.name.localeCompare(right.name));
};

const buildUpcomingDeadlines = (
    tasks: Task[],
    memberNames: Map<number, string>,
    now: Date,
): MemberUpcomingDeadlines[] => {
    const windowEnd = new Date(now.getTime() + UPCOMING_DEADLINE_MS);

    const upcomingTasks = tasks.filter((task) => {
        if (task.status === COMPLETED_STATUS || task.status === "cancelled") {
            return false;
        }

        const dueDate = parseTaskDate(task.due_date);
        return dueDate !== null && dueDate >= now && dueDate <= windowEnd;
    });

    const grouped = groupTasksByAssignee(upcomingTasks);
    const members: MemberUpcomingDeadlines[] = [];

    for (const [userId, memberTasks] of grouped.entries()) {
        const sortedTasks = [...memberTasks]
            .map((task) => ({ task, dueTime: parseTaskDate(task.due_date)?.getTime() ?? 0 }))
            .sort((left, right) => left.dueTime - right.dueTime)
            .map(({ task }) => task);

        members.push({
            user_id: userId,
            name: resolveMemberName(userId, memberNames),
            tasks: sortedTasks.map((task) => ({
                id: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority,
                due_date: task.due_date ?? "",
            })),
        });
    }

    return members.sort((left, right) => left.name.localeCompare(right.name));
};

const fetchMemberNames = async (teamId: number, accessToken: string): Promise<Map<number, string>> => {
    const team = await laravelApiService.getTeam(teamId, accessToken);
    const memberNames = new Map<number, string>();

    for (const member of team.members ?? []) {
        memberNames.set(member.id, member.name);
    }

    return memberNames;
};

const assertTeamAccess = async (
    user: AuthenticatedUser,
    teamId: number,
    accessToken: string,
): Promise<Map<number, string>> => {
    const memberNames = await fetchMemberNames(teamId, accessToken);

    if (user.role !== "admin" && !memberNames.has(user.id)) {
        throw new AppError("You can only view analytics for your own team.", 403);
    }

    return memberNames;
};

const fetchFilteredTasks = async (
    teamId: number,
    accessToken: string,
    range: AnalyticsDateRange,
): Promise<Task[]> => {
    const tasks = await laravelApiService.getAllTeamTasks(teamId, accessToken);
    return tasks.filter((task) => isWithinDateRange(task, range));
};

export const analyticsService = {
    parseTeamId: (value: unknown): number => parsePositiveInt(value, "team_id"),

    parseDateRange: (query: Record<string, unknown>): AnalyticsDateRange => {
        const dateFrom = parseOptionalDate(query.date_from, "date_from");
        const dateTo = parseOptionalDate(query.date_to, "date_to");

        if (dateFrom && dateTo && Date.parse(dateFrom) > Date.parse(dateTo)) {
            throw new AppError("date_from must be earlier than or equal to date_to.", 422);
        }

        const range: AnalyticsDateRange = {};

        if (dateFrom) {
            range.dateFrom = dateFrom;
        }

        if (dateTo) {
            range.dateTo = dateTo;
        }

        return range;
    },

    getTaskSummary: async (
        user: AuthenticatedUser,
        accessToken: string,
        teamId: number,
        range: AnalyticsDateRange,
    ): Promise<TaskSummary> => {
        const cacheKey = buildCacheKey("analytics:task-summary", {
            teamId,
            dateFrom: range.dateFrom,
            dateTo: range.dateTo,
            userId: user.id,
        });

        const cached = cacheService.get<TaskSummary>(cacheKey);

        if (cached) return cached;

        await assertTeamAccess(user, teamId, accessToken);
        const tasks = await fetchFilteredTasks(teamId, accessToken, range);
        const summary = buildTaskSummary(tasks);

        cacheService.set(cacheKey, summary, TASK_SUMMARY_CACHE_TTL_MS);
        return summary;
    },

    getTeamProductivity: async (
        user: AuthenticatedUser,
        accessToken: string,
        teamId: number,
        range: AnalyticsDateRange,
    ): Promise<TeamProductivityReport> => {
        const cacheKey = buildCacheKey("analytics:team-productivity", {
            teamId,
            dateFrom: range.dateFrom,
            dateTo: range.dateTo,
            userId: user.id,
        });

        const cached = cacheService.get<TeamProductivityReport>(cacheKey);

        if (cached) return cached;

        const memberNames = await assertTeamAccess(user, teamId, accessToken);
        const tasks = await fetchFilteredTasks(teamId, accessToken, range);
        const report: TeamProductivityReport = {
            team_id: teamId,
            members: buildTeamProductivity(tasks, memberNames),
        };

        cacheService.set(cacheKey, report, TEAM_PRODUCTIVITY_CACHE_TTL_MS);
        return report;
    },

    getUpcomingDeadlines: async (
        user: AuthenticatedUser,
        accessToken: string,
        teamId: number,
    ): Promise<UpcomingDeadlinesReport> => {
        const cacheKey = buildCacheKey("analytics:upcoming-deadlines", {
            teamId,
            userId: user.id,
        });

        const cached = cacheService.get<UpcomingDeadlinesReport>(cacheKey);

        if (cached) return cached;

        const memberNames = await assertTeamAccess(user, teamId, accessToken);
        const tasks = await laravelApiService.getAllTeamTasks(teamId, accessToken);
        const report: UpcomingDeadlinesReport = {
            team_id: teamId,
            window_days: UPCOMING_DEADLINE_DAYS,
            members: buildUpcomingDeadlines(tasks, memberNames, new Date()),
        };

        cacheService.set(cacheKey, report, UPCOMING_DEADLINES_CACHE_TTL_MS);
        return report;
    },
};
