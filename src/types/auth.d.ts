export type UserRole = "admin" | "manager" | "team_member";

export type AuthenticatedUser = {
    id: number;
    role: UserRole;
    isActive: boolean;
};

export type JwtPayload = {
    sub: string | number;
    role?: UserRole;
    is_active?: boolean;
    exp?: number;
    iat?: number;
};

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
            accessToken?: string;
        }
    }
}