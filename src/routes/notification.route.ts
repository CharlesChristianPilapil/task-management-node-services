import { Router } from "express";
import { notificationController } from "../controllers/notification.controller.js";
import { catchAsync } from "../utils/catch-async.util.js";
import { internalAuthMiddleware } from "../middlewares/internal-auth.middleware.js";
import { notificationRateLimitMiddleware } from "../middlewares/rate-limit.middleware.js";

const notificationRouter = Router();

notificationRouter.post(
    "/send",
    internalAuthMiddleware,
    notificationRateLimitMiddleware,
    catchAsync(notificationController.send),
);

export default notificationRouter;
