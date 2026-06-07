import type {
    NotificationEventType,
    NotificationLogEntry,
    SendNotificationBody,
} from "../types/notification.d.js";
import { logger } from "../utils/logger.util.js";
import { emailService } from "./email.service.js";
import { laravelApiService } from "./laravel-api.service.js";

export const notificationWorkerService = {
    processNotification: async (body: SendNotificationBody): Promise<NotificationLogEntry> => {
        const timestamp = new Date().toISOString();

        try {
            const details = await laravelApiService.getNotificationDetails(
                body.task_id,
                body.user_id,
            );

            const emailStatus = await emailService.sendTaskNotification(
                body.event_type,
                details,
                body.details,
            );

            const entry: NotificationLogEntry = {
                taskId: body.task_id,
                userId: body.user_id,
                eventType: body.event_type,
                email: details.user.email,
                status: emailStatus === "sent" ? "sent" : emailStatus,
                ...(emailStatus === "skipped" ? { reason: "User is inactive." } : {}),
                timestamp,
            };

            logger.notification(entry);

            return entry;
        } catch (error) {
            const entry: NotificationLogEntry = {
                taskId: body.task_id,
                userId: body.user_id,
                eventType: body.event_type,
                email: "unknown",
                status: "failed",
                reason: error instanceof Error ? error.message : "Unknown error",
                timestamp,
            };

            logger.notification(entry);

            return entry;
        }
    },

    isValidEventType: (value: string): value is NotificationEventType => {
        return value === "assigned" || value === "status_changed";
    },
};
