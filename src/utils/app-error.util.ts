export class AppError extends Error {
    readonly statusCode: number;
    readonly errors: unknown;

    constructor(message: string, statusCode = 500, errors: unknown = null) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.errors = errors;
    }
}
