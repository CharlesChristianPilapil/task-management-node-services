import { emailService } from "../services/email.service.js";
import { laravelApiService } from "../services/laravel-api.service.js";
import { envConfig } from "../../config/env.config.js";
import { logger } from "../utils/logger.util.js";
import { retryWithBackoff } from "../utils/retry.util.js";

export const runDeadlineReminderJob = async (): Promise<void> => {
    const reminders = await retryWithBackoff(() => laravelApiService.getDeadlineReminders(), {
        attempts: envConfig.cron.retryAttempts,
        delayMs: envConfig.cron.retryDelayMs,
        jobName: "deadline_reminder",
        operation: "fetch_reminders",
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of reminders.reminders) {
        const result = await emailService.sendDeadlineReminder(entry.user, entry.tasks);

        if (result === "sent") {
            sent += 1;
        } else if (result === "skipped") {
            skipped += 1;
        } else {
            failed += 1;
        }
    }

    logger.info("deadline_reminder_processed", {
        userCount: reminders.reminders.length,
        sent,
        skipped,
        failed,
    });
};
