export type ExportFormat = "csv" | "json" | "xlsx";

export type ExportFilters = {
    status?: string;
    date_from?: string;
    date_to?: string;
};

export type ExportTasksRequest = {
    team_id: number;
    format: ExportFormat;
    filters?: ExportFilters;
};

export type TaskExportRow = {
    id: number;
    title: string;
    description: string;
    status: string;
    status_label: string;
    priority: string;
    priority_label: string;
    due_date: string;
    team_id: number;
    assigned_to: string;
    assignee_name: string;
    created_by: number;
    creator_name: string;
    created_at: string;
    updated_at: string;
};

export type ExportFileResult = {
    filename: string;
    contentType: string;
    taskCount: number;
};
