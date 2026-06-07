import type { User } from "./user.d.js";

export type Task = {
    id: number;
    title: string;
    description: string | null;
    status: string;
    status_label: string;
    priority: string;
    priority_label: string;
    due_date: string | null;
    team_id: number;
    assigned_to: number | null;
    created_by: number;
    assignee?: User;
    creator?: User;
    created_at?: string;
    updated_at?: string;
};

export type PaginatedTasks = {
    tasks: Task[];
    pagination: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
};
