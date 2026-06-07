import { envConfig } from "./env.config.js";

export const dbConfig = {
    url: envConfig.databaseUrl,
} as const;
