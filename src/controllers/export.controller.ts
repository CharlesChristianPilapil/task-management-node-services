import type { Request, Response } from "express";
import { pipeline } from "node:stream/promises";
import { exportService } from "../services/export.service.js";
import { AppError } from "../utils/app-error.util.js";

const requireAuthenticatedRequest = (req: Request): { user: NonNullable<Request["user"]>; accessToken: string } => {
    const user = req.user;
    const accessToken = req.accessToken;

    if (!user || !accessToken) {
        throw new AppError("Authentication required.", 401);
    }

    return { user, accessToken };
};

export const exportController = {
    exportTasks: async (req: Request, res: Response) => {
        const { user, accessToken } = requireAuthenticatedRequest(req);
        const request = exportService.parseRequest(req.body as Record<string, unknown>);
        const { result, stream } = await exportService.exportTasks(user, accessToken, request);

        res.setHeader("Content-Type", result.contentType);
        res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
        res.setHeader("X-Export-Task-Count", String(result.taskCount));

        await pipeline(stream, res);
    },
};
