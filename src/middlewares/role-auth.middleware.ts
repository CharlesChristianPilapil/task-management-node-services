import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../types/auth.d.js";
import { AppError } from "../utils/app-error.util.js";

export const requireRoles = (...roles: UserRole[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user) {
            next(new AppError("Authentication required.", 401));
            return;
        }

        if (!roles.includes(user.role)) {
            next(new AppError("You do not have permission to access this resource.", 403));
            return;
        }

        next();
    };
};
