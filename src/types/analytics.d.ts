export type AnalyticsDateRange = {
    dateFrom?: string;
    dateTo?: string;
};

export type TaskSummary = {
    total_tasks: number;
    completed_tasks: number;
    pending_tasks: number;
    avg_completion_time: number | null;
};

export type MemberProductivity = {
    user_id: number | null;
    name: string;
    task_count: number;
    completed_count: number;
    completion_rate: number;
    avg_completion_time: number | null;
};

export type TeamProductivityReport = {
    team_id: number;
    members: MemberProductivity[];
};

export type UpcomingDeadlineTask = {
    id: number;
    title: string;
    status: string;
    priority: string;
    due_date: string;
};

export type MemberUpcomingDeadlines = {
    user_id: number | null;
    name: string;
    tasks: UpcomingDeadlineTask[];
};

export type UpcomingDeadlinesReport = {
    team_id: number;
    window_days: number;
    members: MemberUpcomingDeadlines[];
};
