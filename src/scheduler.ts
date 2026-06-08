import cron, { type ScheduledTask } from "node-cron";
import { envConfig } from "../config/env.config.js";
import { runDailyDigestJob } from "./jobs/daily-digest.job.js";
import { runDeadlineReminderJob } from "./jobs/deadline-reminder.job.js";
import { runTaskCleanupJob } from "./jobs/task-cleanup.job.js";
import type { CronJobName } from "./types/scheduler.d.js";
import { logger } from "./utils/logger.util.js";

type CronDefinition = {
    name: CronJobName;
    schedule: string;
    handler: () => Promise<void>;
};

const CRON_JOBS: CronDefinition[] = [
    {
        name: "daily_digest",
        schedule: envConfig.cron.schedules.dailyDigest,
        handler: runDailyDigestJob,
    },
    {
        name: "deadline_reminder",
        schedule: envConfig.cron.schedules.deadlineReminder,
        handler: runDeadlineReminderJob,
    },
    {
        name: "task_cleanup",
        schedule: envConfig.cron.schedules.taskCleanup,
        handler: runTaskCleanupJob,
    },
];

let activeTasks: ScheduledTask[] = [];
let runningJobs = 0;
let isShuttingDown = false;
const runningJobNames = new Set<CronJobName>();

const getJob = (name: CronJobName): CronDefinition => {
    const job = CRON_JOBS.find((entry) => entry.name === name);

    if (!job) {
        throw new Error(`Unknown cron job: ${name}`);
    }

    return job;
};

const runJob = async (
    name: CronJobName,
    handler: () => Promise<void>,
    options: { rethrowOnError?: boolean } = {},
): Promise<void> => {
    if (isShuttingDown) {
        logger.warn("cron_skipped_shutdown", { jobName: name });
        return;
    }

    runningJobs += 1;
    runningJobNames.add(name);
    const startedAt = Date.now();

    logger.info("cron_started", { jobName: name });

    try {
        await handler();
        logger.info("cron_completed", {
            jobName: name,
            durationMs: Date.now() - startedAt,
        });
    } catch (error) {
        logger.error("cron_failed", {
            jobName: name,
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
        });

        if (options.rethrowOnError) {
            throw error;
        }
    } finally {
        runningJobs -= 1;
        runningJobNames.delete(name);
    }
};

export const executeCronJob = async (name: CronJobName): Promise<void> => {
    if (runningJobNames.has(name)) {
        throw new Error(`Cron job already running: ${name}`);
    }

    const job = getJob(name);
    await runJob(name, job.handler, { rethrowOnError: true });
};

export const startScheduler = (): void => {
    if (!envConfig.cron.enabled) {
        logger.info("cron_disabled", {
            reason: "CRON_ENABLED is false",
            mode: "external",
            endpoints: CRON_JOBS.map((job) => ({
                name: job.name,
                schedule: job.schedule,
                path: `/api/cron/${job.name.replace(/_/g, "-")}`,
            })),
        });
        return;
    }

    logger.info("cron_mode", {
        mode: "in_process",
        hint: "Set CRON_ENABLED=false and use POST /api/cron/* for external schedulers.",
    });

    activeTasks = CRON_JOBS.map((job) =>
        cron.schedule(
            job.schedule,
            () => {
                void runJob(job.name, job.handler);
            },
            {
                timezone: envConfig.cron.timezone,
            },
        ),
    );

    logger.info("cron_scheduler_started", {
        timezone: envConfig.cron.timezone,
        jobs: CRON_JOBS.map((job) => ({ name: job.name, schedule: job.schedule })),
    });
};

export const stopScheduler = (): void => {
    isShuttingDown = true;

    for (const task of activeTasks) {
        task.stop();
    }

    activeTasks = [];
    logger.info("cron_scheduler_stopped");
};

export const waitForRunningJobs = async (timeoutMs: number): Promise<void> => {
    const startedAt = Date.now();

    while (runningJobs > 0) {
        if (Date.now() - startedAt >= timeoutMs) {
            logger.warn("cron_shutdown_timeout", { runningJobs });
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
    }
};
