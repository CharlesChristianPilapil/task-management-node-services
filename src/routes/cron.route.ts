import { Router } from "express";
import { cronController } from "../controllers/cron.controller.js";
import { internalAuthMiddleware } from "../middlewares/internal-auth.middleware.js";
import { catchAsync } from "../utils/catch-async.util.js";

const cronRouter = Router();

cronRouter.post(
    "/:job",
    internalAuthMiddleware,
    catchAsync(cronController.run),
);

export default cronRouter;
