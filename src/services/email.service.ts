import nodemailer from "nodemailer";
import { mailConfig } from "../../config/mail.config.js";
import type { NotificationDetails, NotificationEventType } from "../types/notification.d.js";
import { logger } from "../utils/logger.util.js";

const transporter = nodemailer.createTransport({
    service: mailConfig.service,
    auth: mailConfig.auth,
});

const formatDueDate = (dueDate: string | null): string => {
    if (!dueDate) return "Not set";

    return new Date(dueDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};

const buildSubject = (eventType: NotificationEventType, taskTitle: string): string => {
    if (eventType === "assigned") {
        return `Task assigned: ${taskTitle}`;
    }

    return `Task status updated: ${taskTitle}`;
};

const buildHtml = (
    eventType: NotificationEventType,
    details: NotificationDetails,
    extraDetails?: Record<string, unknown>,
): string => {
    const { task, user } = details;
    const previousStatus = extraDetails?.previous_status_label as string | undefined;
    const eventLine =
        eventType === "assigned"
            ? `<p>You have been assigned a new task.</p>`
            : `<p>Task status changed to <strong>${task.status_label}</strong>${previousStatus ? ` (was ${previousStatus})` : ""}.</p>`;

    return `
        <h2>Task Notification</h2>
        <p>Hi ${user.name},</p>
        ${eventLine}
        <ul>
            <li><strong>Title:</strong> ${task.title}</li>
            <li><strong>Status:</strong> ${task.status_label}</li>
            <li><strong>Priority:</strong> ${task.priority_label}</li>
            <li><strong>Due date:</strong> ${formatDueDate(task.due_date)}</li>
            <li><strong>Description:</strong> ${task.description ?? "No description"}</li>
        </ul>
    `;
};

export const emailService = {
    async sendTaskNotification(
        eventType: NotificationEventType,
        details: NotificationDetails,
        extraDetails?: Record<string, unknown>,
    ): Promise<"sent" | "skipped" | "failed"> {
        const { task, user } = details;

        if (!user.is_active) {
            logger.warn("email_skipped_inactive_user", {
                userId: user.id,
                email: user.email,
                taskId: task.id,
            });
            return "skipped";
        }

        try {
            await transporter.sendMail({
                from: mailConfig.from,
                to: user.email,
                subject: buildSubject(eventType, task.title),
                html: buildHtml(eventType, details, extraDetails),
            });

            return "sent";
        } catch (error) {
            logger.error("email_send_failed", {
                userId: user.id,
                email: user.email,
                taskId: task.id,
                eventType,
                error: error instanceof Error ? error.message : "Unknown error",
            });

            return "failed";
        }
    },
};
