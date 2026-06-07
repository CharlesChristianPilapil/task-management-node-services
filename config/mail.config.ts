import { envConfig } from "./env.config.js";

export const mailConfig = {
    service: "gmail" as const,
    auth: {
        user: envConfig.mail.user,
        pass: envConfig.mail.pass,
    },
    from: envConfig.mail.user,
} as const;
