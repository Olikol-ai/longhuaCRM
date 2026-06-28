export const APP_ROLES = ['admin', 'teacher', 'student'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const RESTRICTED_ROLES = ['pending', 'user'] as const;

export type NormalizedRole = AppRole | 'pending';

export function normalizeRole(role: string | undefined | null): NormalizedRole {
  if (role === 'admin' || role === 'teacher' || role === 'student') {
    return role;
  }
  return 'pending';
}

export function isAppRole(role: string): role is AppRole {
  return (APP_ROLES as readonly string[]).includes(role);
}
