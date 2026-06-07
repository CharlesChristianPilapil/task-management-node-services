import nodemailer from "nodemailer";
import { mailConfig } from "../../config/mail.config.js";
import type { NotificationDetails, NotificationEventType } from "../types/notification.d.js";
import type { SchedulerTask } from "../types/scheduler.d.js";
import type { User } from "../types/user.d.js";
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

const buildTaskListHtml = (tasks: SchedulerTask[]): string => {
    if (tasks.length === 0) {
        return "<p>No tasks to show.</p>";
    }

    const items = tasks
        .map(
            (task) => `
                <li>
                    <strong>${task.title}</strong>
                    (${task.status_label}, ${task.priority_label})
                    — due ${formatDueDate(task.due_date)}
                </li>
            `,
        ).join("");

    return `<ul>${items}</ul>`;
};

const sendEmail = async (
    user: User,
    subject: string,
    html: string,
    context: Record<string, unknown>,
): Promise<"sent" | "skipped" | "failed"> => {
    if (!user.is_active) {
        logger.warn("email_skipped_inactive_user", {
            userId: user.id,
            email: user.email,
            ...context,
        });
        return "skipped";
    }

    try {
        await transporter.sendMail({
            from: mailConfig.from,
            to: user.email,
            subject,
            html,
        });

        return "sent";
    } catch (error) {
        logger.error("email_send_failed", {
            userId: user.id,
            email: user.email,
            ...context,
            error: error instanceof Error ? error.message : "Unknown error",
        });

        return "failed";
    }
};

export const emailService = {
    sendTaskNotification: async (
        eventType: NotificationEventType,
        details: NotificationDetails,
        extraDetails?: Record<string, unknown>,
    ): Promise<"sent" | "skipped" | "failed"> => {
        const { task, user } = details;

        return sendEmail(
            user,
            buildSubject(eventType, task.title),
            buildHtml(eventType, details, extraDetails),
            { taskId: task.id, eventType },
        );
    },

    sendDailyDigest: async (user: User, tasks: SchedulerTask[]): Promise<"sent" | "skipped" | "failed"> => {
        const html = `
            <h2>Daily Task Digest</h2>
            <p>Hi ${user.name},</p>
            <p>You have <strong>${tasks.length}</strong> incomplete task(s):</p>
            ${buildTaskListHtml(tasks)}
        `;

        return sendEmail(user, `Daily digest: ${tasks.length} incomplete task(s)`, html, {
            jobName: "daily_digest",
            taskCount: tasks.length,
        });
    },

    sendDeadlineReminder: async (user: User, tasks: SchedulerTask[]): Promise<"sent" | "skipped" | "failed"> => {
        const html = `
            <h2>Deadline Reminder</h2>
            <p>Hi ${user.name},</p>
            <p>You have <strong>${tasks.length}</strong> task(s) due within the next 24 hours:</p>
            ${buildTaskListHtml(tasks)}
        `;

        return sendEmail(user, `Deadline reminder: ${tasks.length} task(s) due soon`, html, {
            jobName: "deadline_reminder",
            taskCount: tasks.length,
        });
    },
};
