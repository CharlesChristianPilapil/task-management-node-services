import type { Request, Response } from "express";
import { notificationService } from "../services/notification.service.js";
import type { SendNotificationBody } from "../types/notification.d.js";
import { AppError } from "../utils/app-error.util.js";

const parsePositiveInt = (value: unknown, field: string): number => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new AppError(`Invalid ${field}.`, 422);
    }

    return parsed;
};

export const notificationController = {
    send: async (req: Request, res: Response) => {
        const body = req.body as Partial<SendNotificationBody>;

        const taskId = parsePositiveInt(body.task_id, "task_id");
        const userId = parsePositiveInt(body.user_id, "user_id");
        const eventType = body.event_type;

        if (!eventType || !notificationService.isValidEventType(eventType)) {
            throw new AppError(
                'Invalid event_type. Allowed values: "assigned", "status_changed".',
                422,
            );
        }

        const result = notificationService.queueNotification({
            task_id: taskId,
            user_id: userId,
            event_type: eventType,
            details: body.details ?? {},
        });

        if (!result.queued) {
            res.status(429).json({
                status: "error",
                message: result.reason ?? "Notification was not queued.",
                data: null,
            });
            return;
        }

        res.status(202).json({
            status: "ok",
            message: "Notification queued successfully.",
            data: {
                task_id: taskId,
                user_id: userId,
                event_type: eventType,
            },
        });
    },
};
