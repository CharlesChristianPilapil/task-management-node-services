import type { NotificationJobPayload } from "../types/notification.d.js";
import { notificationWorkerService } from "../services/notification-worker.service.js";

export const processNotificationJob = async (
    payload: NotificationJobPayload,
) => {
    await notificationWorkerService.processNotification({
        task_id: payload.task_id,
        user_id: payload.user_id,
        event_type: payload.event_type,
        ...(payload.details ? { details: payload.details } : {}),
    });
};
