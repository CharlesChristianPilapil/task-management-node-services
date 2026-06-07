import { AppError } from "./app-error.util.js";

export type ValidationErrors = Record<string, string[]>;

export const VALIDATION_FAILED_MESSAGE = "The given data was invalid.";

const toFieldLabel = (field: string): string => field.replaceAll("_", " ").replaceAll(".", " ");

export const validationMessages = {
    required: (field: string): string => `The ${toFieldLabel(field)} field is required.`,
    integer: (field: string): string => `The ${toFieldLabel(field)} field must be an integer.`,
    date: (field: string): string => `The ${toFieldLabel(field)} field must be a valid date.`,
    object: (field: string): string => `The ${toFieldLabel(field)} field must be an object.`,
    in: (field: string): string => `The selected ${toFieldLabel(field)} is invalid.`,
    afterOrEqual: (field: string, otherField: string): string => `The ${toFieldLabel(field)} field must be a date after or equal to ${toFieldLabel(otherField)}.`,
};

export const throwValidationError = (field: string, message: string): never => {
    throw new AppError(VALIDATION_FAILED_MESSAGE, 422, {
        [field]: [message],
    } satisfies ValidationErrors);
};

export const throwValidationErrors = (errors: ValidationErrors): never => {
    throw new AppError(VALIDATION_FAILED_MESSAGE, 422, errors);
};