import { laravelApiService } from "../services/laravel-api.service.js";
import { envConfig } from "../../config/env.config.js";
import { logger } from "../utils/logger.util.js";
import { retryWithBackoff } from "../utils/retry.util.js";

export const runTaskCleanupJob = async (): Promise<void> => {
    const data = await retryWithBackoff(() => laravelApiService.getStaleCancelledTasks(), {
        attempts: envConfig.cron.retryAttempts,
        delayMs: envConfig.cron.retryDelayMs,
        jobName: "task_cleanup",
        operation: "fetch_stale_tasks",
    });

    let archived = 0;
    let failed = 0;

    for (const task of data.tasks) {
        try {
            await retryWithBackoff(() => laravelApiService.archiveTask(task.id), {
                attempts: envConfig.cron.retryAttempts,
                delayMs: envConfig.cron.retryDelayMs,
                jobName: "task_cleanup",
                operation: "archive_task",
            });
            archived += 1;
        } catch (error) {
            failed += 1;
            logger.error("task_cleanup_archive_failed", {
                taskId: task.id,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }

    logger.info("task_cleanup_processed", {
        candidateCount: data.tasks.length,
        archived,
        failed,
    });
};
