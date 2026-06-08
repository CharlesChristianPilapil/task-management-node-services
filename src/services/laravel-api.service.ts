import axios, { type AxiosInstance, isAxiosError } from "axios";
import { envConfig } from "../../config/env.config.js";
import type { ApiResponse } from "../types/api.d.js";
import type { NotificationDetails } from "../types/notification.d.js";
import type {
    DailyDigestData,
    DeadlineReminderData,
    StaleCancelledTasksData,
} from "../types/scheduler.d.js";
import type { PaginatedTasks, Task } from "../types/task.d.js";
import type { Team } from "../types/team.d.js";
import { AppError } from "../utils/app-error.util.js";
import { logger } from "../utils/logger.util.js";

const client = axios.create({
    baseURL: envConfig.laravelApiUrl,
    timeout: 30_000,
    headers: {
        "X-Service-Key": envConfig.internalServiceKey,
        Accept: "application/json",
    },
});

const NOTIFICATIONS_ENDPOINT = "/internal/notifications";
const SCHEDULER_ENDPOINT = "/internal/scheduler";

const createUserClient = (accessToken: string): AxiosInstance =>
    axios.create({
        baseURL: envConfig.laravelApiUrl,
        timeout: 30_000,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
        },
    });

const handleApiError = (error: unknown, context: Record<string, unknown>, fallbackMessage: string): never => {
    if (isAxiosError(error)) {
        const status = error.response?.status ?? 502;
        const message =
            (error.response?.data as { message?: string } | undefined)?.message ?? fallbackMessage;

        logger.error("laravel_api_request_failed", {
            ...context,
            status,
            message,
        });

        throw new AppError(message, status);
    }

    throw error;
};

export const laravelApiService = {
    getNotificationDetails: async (taskId: number, userId: number): Promise<NotificationDetails> => {
        try {
            const response = await client.get<ApiResponse<NotificationDetails>>(`${NOTIFICATIONS_ENDPOINT}/${taskId}/${userId}`);
            return response.data.data;
        } catch (error) {
            return handleApiError(error, { taskId, userId }, "Failed to fetch notification details from Laravel API.");
        }
    },

    getTeam: async (teamId: number, accessToken: string): Promise<Team> => {
        try {
            const response = await createUserClient(accessToken).get<ApiResponse<Team>>(`/teams/${teamId}`);
            return response.data.data;
        } catch (error) {
            return handleApiError(error, { teamId }, "Failed to fetch team from Laravel API.");
        }
    },

    getAllTeamTasks: async (teamId: number, accessToken: string): Promise<Task[]> => {
        const client = createUserClient(accessToken);
        const tasks: Task[] = [];
        let currentPage = 1;
        let lastPage = 1;

        try {
            do {
                const response = await client.get<ApiResponse<PaginatedTasks>>(
                    `/teams/${teamId}/tasks`,
                    { params: { page: currentPage, per_page: 100 } },
                );

                const pageData = response.data.data;
                tasks.push(...pageData.tasks);
                currentPage = pageData.pagination.current_page + 1;
                lastPage = pageData.pagination.last_page;
            } while (currentPage <= lastPage);

            return tasks;
        } catch (error) {
            return handleApiError(error, { teamId }, "Failed to fetch team tasks from Laravel API.");
        }
    },

    getDailyDigest: async (): Promise<DailyDigestData> => {
        try {
            const response = await client.get<ApiResponse<DailyDigestData>>(`${SCHEDULER_ENDPOINT}/daily-digest`);
            return response.data.data;
        } catch (error) {
            return handleApiError(error, {}, "Failed to fetch daily digest data from Laravel API.");
        }
    },

    getDeadlineReminders: async (): Promise<DeadlineReminderData> => {
        try {
            const response = await client.get<ApiResponse<DeadlineReminderData>>(
                `${SCHEDULER_ENDPOINT}/deadline-reminders`,
            );
            return response.data.data;
        } catch (error) {
            return handleApiError(error, {}, "Failed to fetch deadline reminder data from Laravel API.");
        }
    },

    getStaleCancelledTasks: async (): Promise<StaleCancelledTasksData> => {
        try {
            const response = await client.get<ApiResponse<StaleCancelledTasksData>>(
                `${SCHEDULER_ENDPOINT}/stale-cancelled-tasks`,
            );
            return response.data.data;
        } catch (error) {
            return handleApiError(error, {}, "Failed to fetch stale cancelled tasks from Laravel API.");
        }
    },

    archiveTask: async (taskId: number): Promise<void> => {
        try {
            await client.delete(`/tasks/${taskId}/archive`);
        } catch (error) {
            return handleApiError(error, { taskId }, "Failed to archive task via Laravel API.");
        }
    },
};
