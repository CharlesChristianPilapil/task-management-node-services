import type { NextFunction, Request, Response } from "express";
import { envConfig } from "../../config/env.config.js";
import { AppError } from "../utils/app-error.util.js";

export const internalAuthMiddleware = (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    const serviceKey = req.header("X-Service-Key");

    if (!serviceKey || serviceKey !== envConfig.internalServiceKey) {
        next(new AppError("Unauthorized internal request.", 401));
        return;
    }

    next();
};
