import type { Request, Response } from "express";
import { analyticsService } from "../services/analytics.service.js";
import { AppError } from "../utils/app-error.util.js";

const requireAuthenticatedRequest = (req: Request): { user: NonNullable<Request["user"]>; accessToken: string } => {
    const user = req.user;
    const accessToken = req.accessToken;

    if (!user || !accessToken) {
        throw new AppError("Authentication required.", 401);
    }

    return { user, accessToken };
};

export const analyticsController = {
    taskSummary: async (req: Request, res: Response) => {
        const { user, accessToken } = requireAuthenticatedRequest(req);
        const teamId = analyticsService.parseTeamId(req.query.team_id);
        const range = analyticsService.parseDateRange(req.query as Record<string, unknown>);
        const summary = await analyticsService.getTaskSummary(user, accessToken, teamId, range);

        res.status(200).json({
            status: "ok",
            message: "Task summary retrieved successfully.",
            data: summary,
        });
    },

    teamProductivity: async (req: Request, res: Response) => {
        const { user, accessToken } = requireAuthenticatedRequest(req);
        const teamId = analyticsService.parseTeamId(req.query.team_id);
        const range = analyticsService.parseDateRange(req.query as Record<string, unknown>);
        const report = await analyticsService.getTeamProductivity(user, accessToken, teamId, range);

        res.status(200).json({
            status: "ok",
            message: "Team productivity report retrieved successfully.",
            data: report,
        });
    },

    upcomingDeadlines: async (req: Request, res: Response) => {
        const { user, accessToken } = requireAuthenticatedRequest(req);
        const teamId = analyticsService.parseTeamId(req.query.team_id);
        const report = await analyticsService.getUpcomingDeadlines(user, accessToken, teamId);

        res.status(200).json({
            status: "ok",
            message: "Upcoming deadlines retrieved successfully.",
            data: report,
        });
    },
};
