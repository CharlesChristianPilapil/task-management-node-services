import type { NotificationJobPayload } from "../types/notification.d.js";
import { processNotificationJob } from "../jobs/notification.jobs.js";
import { logger } from "../utils/logger.util.js";

const queue: NotificationJobPayload[] = [];
let isProcessing = false;

const logQueueError = (error: unknown) => {
    logger.error("notification_queue_processing_failed", {
        error: error instanceof Error ? error.message : "Unknown error",
    });
};

const scheduleProcessNext = () => {
    setImmediate(() => processNext().catch(logQueueError));
};

const processNext = async () => {
    if (isProcessing) return;

    const job = queue.shift();

    if (!job) return;

    isProcessing = true;

    try {
        await processNotificationJob(job);
    } catch (error) {
        logger.error("notification_job_failed", {
            taskId: job.task_id,
            userId: job.user_id,
            eventType: job.event_type,
            error: error instanceof Error ? error.message : "Unknown error",
        });
    } finally {
        isProcessing = false;

        if (queue.length > 0) {
            scheduleProcessNext();
        }
    }
};

export const notificationQueueService = {
    enqueue: (payload: Omit<NotificationJobPayload, "queued_at">) => {
        queue.push({
            ...payload,
            queued_at: new Date().toISOString(),
        });

        logger.info("notification_queued", {
            taskId: payload.task_id,
            userId: payload.user_id,
            eventType: payload.event_type,
            queueSize: queue.length,
        });

        scheduleProcessNext();
    },
};
