import { config } from "dotenv";

config();

const get = (key: string): string | undefined => process.env[key]?.trim() || undefined;

const requireEnv = (key: string): string => {
    const value = get(key);

    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
};

const parsePort = (value: string): number => {
    const port = Number(value);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid PORT value: ${value}`);
    }

    return port;
};

const parseOrigins = (value: string): string | string[] => {
    if (value === "*") {
        return "*";
    }

    return value.split(",").map((origin) => origin.trim()).filter(Boolean);
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        return fallback;
    }

    return parsed;
};

export const envConfig = {
    nodeEnv: get("NODE_ENV") ?? "development",
    port: parsePort(get("PORT") ?? "3000"),
    host: get("HOST") ?? "0.0.0.0",
    appUrl: requireEnv("APP_URL"),
    laravelApiUrl: requireEnv("LARAVEL_API_URL"),
    jwtSecret: requireEnv("JWT_SECRET"),
    internalServiceKey: requireEnv("INTERNAL_SERVICE_KEY"),
    corsOrigins: parseOrigins(get("CORS_ORIGINS") ?? "*"),
    mail: {
        user: requireEnv("EMAIL_USER"),
        pass: requireEnv("EMAIL_PASS"),
    },
    rateLimit: {
        windowMs: parsePositiveInt(get("RATE_LIMIT_WINDOW_MS"), 60_000),
        maxRequests: parsePositiveInt(get("RATE_LIMIT_MAX_REQUESTS"), 30),
        perUserMax: parsePositiveInt(get("RATE_LIMIT_PER_USER_MAX"), 5),
        perUserWindowMs: parsePositiveInt(get("RATE_LIMIT_PER_USER_WINDOW_MS"), 3_600_000),
    },
    cron: {
        enabled: (get("CRON_ENABLED") ?? "true").toLowerCase() !== "false",
        timezone: get("CRON_TIMEZONE") ?? "UTC",
        retryAttempts: parsePositiveInt(get("CRON_RETRY_ATTEMPTS"), 3),
        retryDelayMs: parsePositiveInt(get("CRON_RETRY_DELAY_MS"), 1_000),
        schedules: {
            dailyDigest: get("CRON_DAILY_DIGEST") ?? "0 8 * * *",
            deadlineReminder: get("CRON_DEADLINE_REMINDER") ?? "0 */2 * * *",
            taskCleanup: get("CRON_TASK_CLEANUP") ?? "0 0 * * *",
        },
    },
} as const;
