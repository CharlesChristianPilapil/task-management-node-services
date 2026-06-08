import express from "express";
import cors from "cors";
import { envConfig } from "../config/env.config.js";
import analyticsRouter from "./routes/analytics.route.js";
import cronRouter from "./routes/cron.route.js";
import exportRouter from "./routes/export.route.js";
import notificationRouter from "./routes/notification.route.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.middleware.js";
import { AppError } from "./utils/app-error.util.js";

const app = express();

app.use(
    cors({
        origin: envConfig.corsOrigins,
    }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/api/cron", cronRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/export", exportRouter);

app.use((_req, _res, next) => {
    next(new AppError("Route not found.", 404));
});

app.use(errorHandlerMiddleware);

export default app;
