import type { NotificationLogEntry } from "../types/notification.d.js";

type LogLevel = "info" | "warn" | "error";

const write = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
    const entry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...meta,
    };

    const output = JSON.stringify(entry);

    if (level === "error") {
        console.error(output);
        return;
    }

    if (level === "warn") {
        console.warn(output);
        return;
    }

    console.log(output);
};

export const logger = {
    info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
    notification: (entry: NotificationLogEntry) => write("info", "notification_processed", entry as unknown as Record<string, unknown>),
};
