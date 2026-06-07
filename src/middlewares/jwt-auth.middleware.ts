import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { envConfig } from "../../config/env.config.js";
import type { AuthenticatedUser, JwtPayload, UserRole } from "../types/auth.d.js";
import { AppError } from "../utils/app-error.util.js";

const ALLOWED_ROLES: UserRole[] = ["admin", "manager", "team_member"];

const parseUserId = (subject: string | number): number => {
    const userId = Number(subject);

    if (!Number.isInteger(userId) || userId < 1) {
        throw new AppError("Invalid authentication token.", 401);
    }

    return userId;
};

const parseRole = (role: unknown): UserRole => {
    if (typeof role !== "string" || !ALLOWED_ROLES.includes(role as UserRole)) {
        throw new AppError("Invalid authentication token.", 401);
    }

    return role as UserRole;
};

export const jwtAuthMiddleware = (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    const authorization = req.header("Authorization");

    if (!authorization || !authorization.startsWith("Bearer ")) {
        next(new AppError("Authentication required.", 401));
        return;
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
        next(new AppError("Authentication required.", 401));
        return;
    }

    try {
        const payload = jwt.verify(token, envConfig.jwtSecret) as JwtPayload;

        if (payload.is_active === false) {
            next(new AppError("Your account has been deactivated.", 403));
            return;
        }

        const user: AuthenticatedUser = {
            id: parseUserId(payload.sub),
            role: parseRole(payload.role),
            isActive: payload.is_active ?? true,
        };

        req.user = user;
        req.accessToken = token;
        next();
    } catch {
        next(new AppError("Invalid or expired authentication token.", 401));
    }
};
