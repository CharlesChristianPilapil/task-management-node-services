export type ApiResponse<T> = {
    status: string;
    message: string;
    data: T;
};

export type ApiErrorResponse = {
    status: "error";
    message: string;
    errors: Record<string, string[]> | null;
};