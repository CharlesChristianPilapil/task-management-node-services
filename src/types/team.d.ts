export type TeamMember = {
    id: number;
    name: string;
    email: string;
    role: string;
    role_label: string;
};

export type Team = {
    id: number;
    name: string;
    created_by: number;
    members?: TeamMember[];
};