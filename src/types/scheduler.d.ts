import type { Task } from "./task.d.js";
import type { User } from "./user.d.js";

export type SchedulerTask = Pick<
    Task,
    | "id"
    | "title"
    | "description"
    | "status"
    | "status_label"
    | "priority"
    | "priority_label"
    | "due_date"
    | "team_id"
    | "assigned_to"
    | "created_by"
>;

export type UserTaskGroup = {
    user: User;
    tasks: SchedulerTask[];
};

export type DailyDigestData = {
    users: UserTaskGroup[];
};

export type DeadlineReminderData = {
    reminders: UserTaskGroup[];
};

export type StaleCancelledTask = {
    id: number;
    title: string;
    status: string;
    team_id: number;
    updated_at: string;
};

export type StaleCancelledTasksData = {
    tasks: StaleCancelledTask[];
};

export type CronJobName = "daily_digest" | "deadline_reminder" | "task_cleanup";
