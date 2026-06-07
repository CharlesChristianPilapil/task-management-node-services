import { envConfig } from "./env.config.js";

export const passportConfig = {
    jwtSecret: envConfig.jwtSecret,
    laravelApiUrl: envConfig.laravelApiUrl,
} as const;
