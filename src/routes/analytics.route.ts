import { Router } from "express";
import { analyticsController } from "../controllers/analytics.controller.js";
import { jwtAuthMiddleware } from "../middlewares/jwt-auth.middleware.js";
import { requireRoles } from "../middlewares/role-auth.middleware.js";
import { catchAsync } from "../utils/catch-async.util.js";

const analyticsRouter = Router();

analyticsRouter.use(jwtAuthMiddleware, requireRoles("admin", "manager"));

analyticsRouter.get("/task-summary", catchAsync(analyticsController.taskSummary));
analyticsRouter.get("/team-productivity", catchAsync(analyticsController.teamProductivity));
analyticsRouter.get("/upcoming-deadlines", catchAsync(analyticsController.upcomingDeadlines));

export default analyticsRouter;