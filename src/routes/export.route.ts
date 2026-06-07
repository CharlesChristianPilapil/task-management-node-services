import { Router } from "express";
import { exportController } from "../controllers/export.controller.js";
import { jwtAuthMiddleware } from "../middlewares/jwt-auth.middleware.js";
import { requireRoles } from "../middlewares/role-auth.middleware.js";
import { catchAsync } from "../utils/catch-async.util.js";

const exportRouter = Router();

exportRouter.use(jwtAuthMiddleware, requireRoles("admin", "manager"));

exportRouter.post("/tasks", catchAsync(exportController.exportTasks));

export default exportRouter;