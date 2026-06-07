import type { Task } from "./task.d.js";
import type { User } from "./user.d.js";

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

export type NotificationDetails = {
    task: Task;
    user: User;
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
