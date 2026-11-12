export const Role = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  STAFF: 'STAFF',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/** Roles que entran con código + PIN y que un admin puede gestionar por API. */
export const STAFF_ROLES = [Role.SUPERVISOR, Role.STAFF] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
