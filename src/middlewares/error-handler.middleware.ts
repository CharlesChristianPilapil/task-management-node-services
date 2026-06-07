import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.util.js";
import { logger } from "../utils/logger.util.js";

export const errorHandlerMiddleware = (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
) => {
    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            status: "error",
            message: error.message,
            errors: error.errors,
        });
        return;
    }

    logger.error("unhandled_error", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
        status: "error",
        message: "Internal server error.",
        errors: null,
    });
};
