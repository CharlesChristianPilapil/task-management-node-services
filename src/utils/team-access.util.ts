import type { AuthenticatedUser } from "../types/auth.d.js";
import { laravelApiService } from "../services/laravel-api.service.js";
import { AppError } from "./app-error.util.js";

export const ANALYTICS_TEAM_ACCESS_DENIED_MESSAGE = "You do not belong to this team and cannot view its analytics.";
export const EXPORT_TEAM_ACCESS_DENIED_MESSAGE = "You do not belong to this team and cannot export its tasks.";

const fetchTeamMemberNames = async (teamId: number, accessToken: string): Promise<Map<number, string>> => {
    const team = await laravelApiService.getTeam(teamId, accessToken);
    const memberNames = new Map<number, string>();

    for (const member of team.members ?? []) {
        memberNames.set(member.id, member.name);
    }

    return memberNames;
};

export const assertTeamAccess = async (
    user: AuthenticatedUser,
    teamId: number,
    accessToken: string,
    deniedMessage: string,
): Promise<Map<number, string>> => {
    if (user.role === "admin") {
        return fetchTeamMemberNames(teamId, accessToken);
    }

    try {
        const memberNames = await fetchTeamMemberNames(teamId, accessToken);

        if (!memberNames.has(user.id)) {
            throw new AppError(deniedMessage, 403);
        }

        return memberNames;
    } catch (error) {
        if (error instanceof AppError && error.statusCode === 403) {
            throw new AppError(deniedMessage, 403);
        }

        throw error;
    }
};
