import rateLimit from "express-rate-limit";
import { envConfig } from "../../config/env.config.js";

export const notificationRateLimitMiddleware = rateLimit({
    windowMs: envConfig.rateLimit.windowMs,
    max: envConfig.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: "error",
        message: "Too many notification requests. Please try again later.",
        errors: null,
    },
});
