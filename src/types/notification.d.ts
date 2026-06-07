export type NotificationEventType = "assigned" | "status_changed";

export type SendNotificationBody = {
    task_id: number;
    user_id: number;
    event_type: NotificationEventType;
    details?: Record<string, unknown>;
};

export type NotificationJobPayload = SendNotificationBody & {
    queued_at: string;
};

export type LaravelUser = {
    id: number;
    name: string;
    email: string;
    role: string;
    role_label: string;
    is_active: boolean;
};

export type LaravelTask = {
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
    assignee?: LaravelUser;
    creator?: LaravelUser;
};

export type NotificationDetails = {
    task: LaravelTask;
    user: LaravelUser;
};

export type NotificationLogEntry = {
    taskId: number;
    userId: number;
    eventType: NotificationEventType;
    email: string;
    status: "sent" | "failed" | "skipped";
    reason?: string;
    timestamp: string;
};
