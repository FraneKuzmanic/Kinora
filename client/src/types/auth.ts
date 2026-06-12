export const appRoles = ["audience", "cinema_admin", "validator"] as const;

export type AppRole = (typeof appRoles)[number];
