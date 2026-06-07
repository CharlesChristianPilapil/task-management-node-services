import { logger } from "./logger.util.js";

type RetryOptions = {
    attempts: number;
    delayMs: number;
    jobName: string;
    operation: string;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    options: RetryOptions,
): Promise<T> => {
    const { attempts, delayMs, jobName, operation } = options;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === attempts) {
                break;
            }

            const waitMs = delayMs * attempt;

            logger.warn("cron_retry_scheduled", {
                jobName,
                operation,
                attempt,
                maxAttempts: attempts,
                delayMs: waitMs,
                error: error instanceof Error ? error.message : "Unknown error",
            });

            await sleep(waitMs);
        }
    }

    throw lastError;
};
