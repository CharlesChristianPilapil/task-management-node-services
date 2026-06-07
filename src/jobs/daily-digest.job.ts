import { emailService } from "../services/email.service.js";
import { laravelApiService } from "../services/laravel-api.service.js";
import { envConfig } from "../../config/env.config.js";
import { logger } from "../utils/logger.util.js";
import { retryWithBackoff } from "../utils/retry.util.js";

export const runDailyDigestJob = async (): Promise<void> => {
    const digest = await retryWithBackoff(() => laravelApiService.getDailyDigest(), {
        attempts: envConfig.cron.retryAttempts,
        delayMs: envConfig.cron.retryDelayMs,
        jobName: "daily_digest",
        operation: "fetch_digest",
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of digest.users) {
        const result = await emailService.sendDailyDigest(entry.user, entry.tasks);

        if (result === "sent") {
            sent += 1;
        } else if (result === "skipped") {
            skipped += 1;
        } else {
            failed += 1;
        }
    }

    logger.info("daily_digest_processed", {
        userCount: digest.users.length,
        sent,
        skipped,
        failed,
    });
};
