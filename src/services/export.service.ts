import { format } from "fast-csv";
import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";
import * as XLSX from "xlsx";
import type { AuthenticatedUser } from "../types/auth.d.js";
import type {
    ExportFileResult,
    ExportFilters,
    ExportFormat,
    ExportTasksRequest,
    TaskExportRow,
} from "../types/export.d.js";
import type { Task } from "../types/task.d.js";
import { AppError } from "../utils/app-error.util.js";
import { logger } from "../utils/logger.util.js";
import { EXPORT_TEAM_ACCESS_DENIED_MESSAGE, assertTeamAccess } from "../utils/team-access.util.js";
import {
    throwValidationError,
    validationMessages,
    VALIDATION_FAILED_MESSAGE,
} from "../utils/validation-error.util.js";
import { laravelApiService } from "./laravel-api.service.js";

const VALID_FORMATS = new Set<ExportFormat>(["csv", "json", "xlsx"]);
const VALID_STATUSES = new Set(["pending", "in_progress", "completed", "cancelled"]);

const EXPORT_COLUMNS: (keyof TaskExportRow)[] = [
    "id",
    "title",
    "description",
    "status",
    "status_label",
    "priority",
    "priority_label",
    "due_date",
    "team_id",
    "assigned_to",
    "assignee_name",
    "created_by",
    "creator_name",
    "created_at",
    "updated_at",
];

const parsePositiveInt = (value: unknown, field: string): number => {
    if (value === undefined || value === null || value === "") {
        throwValidationError(field, validationMessages.required(field));
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        throwValidationError(field, validationMessages.integer(field));
    }

    return parsed;
};

const parseOptionalDate = (value: unknown, field: string): string | undefined => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    if (typeof value !== "string") {
        return throwValidationError(field, validationMessages.date(field));
    }

    const timestamp = Date.parse(value);

    if (Number.isNaN(timestamp)) {
        throwValidationError(field, validationMessages.date(field));
    }

    return new Date(timestamp).toISOString();
};

const parseTaskDate = (value: string | null | undefined): Date | null => {
    if (!value) {
        return null;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : new Date(timestamp);
};

const resolveMemberName = (userId: number | null, memberNames: Map<number, string>): string => {
    if (userId === null) {
        return "Unassigned";
    }

    return memberNames.get(userId) ?? `User #${userId}`;
};

const matchesFilters = (task: Task, filters: ExportFilters): boolean => {
    if (filters.status && task.status !== filters.status) {
        return false;
    }

    const createdAt = parseTaskDate(task.created_at);

    if (!createdAt) {
        return true;
    }

    if (filters.date_from) {
        const from = Date.parse(filters.date_from);

        if (!Number.isNaN(from) && createdAt.getTime() < from) {
            return false;
        }
    }

    if (filters.date_to) {
        const to = Date.parse(filters.date_to);

        if (!Number.isNaN(to) && createdAt.getTime() > to) {
            return false;
        }
    }

    return true;
};

const toExportRow = (task: Task, memberNames: Map<number, string>): TaskExportRow => ({
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    status_label: task.status_label,
    priority: task.priority,
    priority_label: task.priority_label,
    due_date: task.due_date ?? "",
    team_id: task.team_id,
    assigned_to: task.assigned_to === null ? "" : String(task.assigned_to),
    assignee_name: resolveMemberName(task.assigned_to, memberNames),
    created_by: task.created_by,
    creator_name: resolveMemberName(task.created_by, memberNames),
    created_at: task.created_at ?? "",
    updated_at: task.updated_at ?? "",
});

const buildFilename = (teamId: number, format: ExportFormat): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `tasks-team-${teamId}-${timestamp}.${format === "xlsx" ? "xlsx" : format}`;
};

const getContentType = (format: ExportFormat): string => {
    switch (format) {
        case "csv":
            return "text/csv; charset=utf-8";
        case "json":
            return "application/json; charset=utf-8";
        case "xlsx":
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
};

const createCsvStream = (rows: TaskExportRow[]): Readable => {
    const csvStream = format({ headers: true, writeHeaders: true });

    for (const row of rows) {
        csvStream.write(row);
    }

    csvStream.end();
    return csvStream;
};

const createJsonStream = (rows: TaskExportRow[]): Readable => {
    const stream = new PassThrough();
    let index = 0;

    stream.write("[");

    for (const row of rows) {
        if (index > 0) {
            stream.write(",");
        }

        stream.write(JSON.stringify(row));
        index += 1;
    }

    stream.write("]");
    stream.end();

    return stream;
};

const createXlsxStream = (rows: TaskExportRow[]): Readable => {
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const stream = new PassThrough();
    stream.end(buffer);

    return stream;
};

const createExportStream = (rows: TaskExportRow[], format: ExportFormat): Readable => {
    switch (format) {
        case "csv":
            return createCsvStream(rows);
        case "json":
            return createJsonStream(rows);
        case "xlsx":
            return createXlsxStream(rows);
    }
};

export const exportService = {
    parseRequest: (body: Record<string, unknown> | undefined): ExportTasksRequest => {
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            throw new AppError(VALIDATION_FAILED_MESSAGE, 422, {
                body: ["The request body is required."],
            });
        }

        const teamId = parsePositiveInt(body.team_id, "team_id");

        if (body.format === undefined || body.format === null || body.format === "") {
            throwValidationError("format", validationMessages.required("format"));
        }

        if (typeof body.format !== "string" || !VALID_FORMATS.has(body.format as ExportFormat)) {
            throwValidationError("format", validationMessages.in("format"));
        }

        const format = body.format as ExportFormat;
        const rawFilters = body.filters;

        if (rawFilters !== undefined && (typeof rawFilters !== "object" || rawFilters === null || Array.isArray(rawFilters))) {
            throwValidationError("filters", validationMessages.object("filters"));
        }

        const filters: ExportFilters = {};
        const filterInput = (rawFilters ?? {}) as Record<string, unknown>;

        if (filterInput.status !== undefined && filterInput.status !== null && filterInput.status !== "") {
            const status = filterInput.status;

            if (typeof status === "string" && VALID_STATUSES.has(status)) {
                filters.status = status;
            } else {
                throwValidationError("filters.status", validationMessages.in("filters.status"));
            }
        }

        const dateFrom = parseOptionalDate(filterInput.date_from, "filters.date_from");
        const dateTo = parseOptionalDate(filterInput.date_to, "filters.date_to");

        if (dateFrom && dateTo && Date.parse(dateFrom) > Date.parse(dateTo)) {
            throwValidationError(
                "filters.date_to",
                validationMessages.afterOrEqual("filters.date_to", "filters.date_from"),
            );
        }

        if (dateFrom) {
            filters.date_from = dateFrom;
        }

        if (dateTo) {
            filters.date_to = dateTo;
        }

        const request: ExportTasksRequest = {
            team_id: teamId,
            format,
        };

        if (Object.keys(filters).length > 0) {
            request.filters = filters;
        }

        return request;
    },

    exportTasks: async (
        user: AuthenticatedUser,
        accessToken: string,
        request: ExportTasksRequest,
    ): Promise<{ result: ExportFileResult; stream: Readable }> => {
        const { team_id: teamId, format, filters = {} } = request;

        try {
            const memberNames = await assertTeamAccess(
                user,
                teamId,
                accessToken,
                EXPORT_TEAM_ACCESS_DENIED_MESSAGE,
            );
            const allTasks = await laravelApiService.getAllTeamTasks(teamId, accessToken);
            const rows = allTasks.filter((task) => matchesFilters(task, filters)).map((task) => toExportRow(task, memberNames));

            const result: ExportFileResult = {
                filename: buildFilename(teamId, format),
                contentType: getContentType(format),
                taskCount: rows.length,
            };

            logger.info("task_export_started", {
                userId: user.id,
                userRole: user.role,
                teamId,
                format,
                filters,
                taskCount: rows.length,
            });

            const stream = createExportStream(rows, format);

            stream.on("end", () => {
                logger.info("task_export_completed", {
                    userId: user.id,
                    teamId,
                    format,
                    filters,
                    taskCount: rows.length,
                });
            });

            stream.on("error", (error) => {
                logger.error("task_export_stream_failed", {
                    userId: user.id,
                    teamId,
                    format,
                    filters,
                    error: error instanceof Error ? error.message : "Unknown stream error",
                });
            });

            return { result, stream };
        } catch (error) {
            logger.error("task_export_failed", {
                userId: user.id,
                teamId,
                format,
                filters,
                error: error instanceof Error ? error.message : "Unknown error",
            });

            throw error;
        }
    },
};
