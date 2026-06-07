import type { Server } from "node:http";
import { envConfig } from "../config/env.config.js";
import app from "./app.js";
import { startScheduler, stopScheduler, waitForRunningJobs } from "./scheduler.js";
import { logger } from "./utils/logger.util.js";

const { port, host, appUrl } = envConfig;

const SHUTDOWN_TIMEOUT_MS = 15_000;

let server: Server | undefined;

const shutdown = async (signal: string) => {
    logger.info("shutdown_started", { signal });

    stopScheduler();
    await waitForRunningJobs(SHUTDOWN_TIMEOUT_MS);

    if (server) {
        await new Promise<void>((resolve, reject) => {
            server?.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }

    logger.info("shutdown_completed", { signal });
    process.exit(0);
};

server = app.listen(port, host, () => {
    console.log(`Application is running at ${appUrl}`);
    startScheduler();
});

process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
    void shutdown("SIGINT");
});
