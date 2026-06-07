import axios, { isAxiosError } from "axios";
import { envConfig } from "../../config/env.config.js";
import type { NotificationDetails } from "../types/notification.d.js";
import { AppError } from "../utils/app-error.util.js";
import { logger } from "../utils/logger.util.js";

const client = axios.create({
    baseURL: envConfig.laravelApiUrl,
    timeout: 10_000,
    headers: {
        "X-Service-Key": envConfig.internalServiceKey,
        Accept: "application/json",
    },
});

const BASE_ENDPOINT = "/internal/notifications";

type LaravelApiResponse<T> = {
    status: string;
    message: string;
    data: T;
};

export const laravelApiService = {
    async getNotificationDetails(taskId: number, userId: number): Promise<NotificationDetails> {
        try {
            const response = await client.get<LaravelApiResponse<NotificationDetails>>(`${BASE_ENDPOINT}/${taskId}/${userId}`);
            return response.data.data;
        } catch (error) {
            if (isAxiosError(error)) {
                const status = error.response?.status ?? 502;
                const message =
                    (error.response?.data as { message?: string } | undefined)?.message ??
                    "Failed to fetch notification details from Laravel API.";

                logger.error("laravel_api_request_failed", {
                    taskId,
                    userId,
                    status,
                    message,
                });

                throw new AppError(message, status);
            }

            throw error;
        }
    },
};
