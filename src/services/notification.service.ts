import { envConfig } from "../../config/env.config.js";
import type { SendNotificationBody } from "../types/notification.d.js";
import { logger } from "../utils/logger.util.js";
import { notificationQueueService } from "./notification-queue.service.js";
import { notificationWorkerService } from "./notification-worker.service.js";

type UserRateBucket = {
    count: number;
    windowStartedAt: number;
};

const userRateBuckets = new Map<number, UserRateBucket>();

const isUserRateLimited = (userId: number): boolean => {
    const now = Date.now();
    const bucket = userRateBuckets.get(userId);

    if (!bucket || now - bucket.windowStartedAt >= envConfig.rateLimit.perUserWindowMs) {
        userRateBuckets.set(userId, { count: 1, windowStartedAt: now });
        return false;
    }

    if (bucket.count >= envConfig.rateLimit.perUserMax) {
        return true;
    }

    bucket.count += 1;
    return false;
};

export const notificationService = {
    queueNotification(body: SendNotificationBody): { queued: boolean; reason?: string } {
        if (isUserRateLimited(body.user_id)) {
            logger.warn("notification_rate_limited", {
                userId: body.user_id,
                taskId: body.task_id,
                eventType: body.event_type,
            });

            return {
                queued: false,
                reason: "Rate limit exceeded for this user.",
            };
        }

        notificationQueueService.enqueue(body);

        return { queued: true };
    },

    isValidEventType: notificationWorkerService.isValidEventType,
};
