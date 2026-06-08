import type { Request, Response } from "express";
import { executeCronJob } from "../scheduler.js";
import type { CronJobName } from "../types/scheduler.d.js";
import { AppError } from "../utils/app-error.util.js";

const CRON_ROUTE_TO_JOB: Record<string, CronJobName> = {
    "daily-digest": "daily_digest",
    "deadline-reminder": "deadline_reminder",
    "task-cleanup": "task_cleanup",
};

export const cronController = {
    run: async (req: Request, res: Response) => {
        const jobKey = String(req.params.job ?? "");
        const jobName = CRON_ROUTE_TO_JOB[jobKey];

        if (!jobName) {
            throw new AppError("Unknown cron job.", 404);
        }

        try {
            await executeCronJob(jobName);
        } catch (error) {
            if (error instanceof Error && error.message.startsWith("Cron job already running:")) {
                throw new AppError(error.message, 409);
            }

            throw error;
        }

        res.status(200).json({
            status: "ok",
            message: `${jobName} completed successfully.`,
            data: { job: jobName },
        });
    },
};
