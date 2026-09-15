import { UserEntity } from '../users/entities/user.entity';

export const USER_STATUSES = ['pending', 'active', 'blocked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const DASHBOARD_ROLES = [
  'admin',
  'teacher',
  'tutor',
  'student',
  'tutor_student',
  'sales_manager',
] as const;
export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export const ONBOARDING_STATES = [
  'needs_verification',
  'awaiting_role',
  'active',
  'blocked',
] as const;
export type OnboardingState = (typeof ONBOARDING_STATES)[number];

export const ONBOARDING_PATH = '/auth/pending-approval';

/** DB values that mean the account is waiting for admin role assignment. */
export const AWAITING_ROLE_DB_VALUES = new Set(['', 'pending', 'pending-role']);

/** DB value set when admin explicitly assigns «Нет роли». */
export const EXPLICIT_NO_ROLE_DB_VALUE = 'user';

const NON_DASHBOARD_ROLE_DB_VALUES = new Set([
  ...AWAITING_ROLE_DB_VALUES,
  EXPLICIT_NO_ROLE_DB_VALUE,
]);

/** Normalize DB role to dashboard role or null (unassigned). */
export function normalizeUserRole(role: string | null | undefined): DashboardRole | null {
  if (!role || NON_DASHBOARD_ROLE_DB_VALUES.has(role)) {
    return null;
  }
  if ((DASHBOARD_ROLES as readonly string[]).includes(role)) {
    return role as DashboardRole;
  }
  return null;
}

/** Persistable role value for DB. Empty string = awaiting role assignment. */
export function toDbRole(role: string | null | undefined): string {
  if (!role) {
    return '';
  }
  if (role === EXPLICIT_NO_ROLE_DB_VALUE) {
    return EXPLICIT_NO_ROLE_DB_VALUE;
  }
  if (role === 'pending' || role === 'pending-role') {
    return '';
  }
  if ((DASHBOARD_ROLES as readonly string[]).includes(role)) {
    return role;
  }
  return '';
}

export function isExplicitNoRole(role: string | null | undefined): boolean {
  return role === EXPLICIT_NO_ROLE_DB_VALUE;
}

/**
 * Admin UI / directory role key — distinct from dashboard `role`.
 * `pending` = awaiting assignment; `user` = intentional no role.
 */
export function getAccountRole(
  status: string | null | undefined,
  dbRole: string | null | undefined,
): string {
  if (getOnboardingState(status, dbRole) === 'awaiting_role') {
    return 'pending';
  }
  const dashboard = normalizeUserRole(dbRole);
  if (dashboard) {
    return dashboard;
  }
  if (isExplicitNoRole(dbRole)) {
    return EXPLICIT_NO_ROLE_DB_VALUE;
  }
  return 'pending';
}

export function getOnboardingState(
  status: string | null | undefined,
  role: string | null | undefined,
): OnboardingState {
  const normalizedStatus = status || 'pending';
  if (normalizedStatus === 'blocked') {
    return 'blocked';
  }
  if (normalizedStatus === 'pending') {
    return 'needs_verification';
  }
  if (normalizedStatus === 'active' && isExplicitNoRole(role)) {
    return 'active';
  }
  const dashboardRole = normalizeUserRole(role);
  if (normalizedStatus === 'active' && !dashboardRole) {
    return 'awaiting_role';
  }
  if (normalizedStatus === 'active' && dashboardRole) {
    return 'active';
  }
  return 'needs_verification';
}

export function getRedirectPath(
  onboardingState: OnboardingState,
  role: DashboardRole | null,
): string {
  if (onboardingState !== 'active') {
    return ONBOARDING_PATH;
  }
  switch (role) {
    case 'admin':
      return '/Dashboard';
    case 'teacher':
      return '/TeacherDashboard';
    case 'tutor':
      return '/TutorDashboard';
    case 'student':
      return '/StudentDashboard';
    case 'tutor_student':
      return '/Profile';
    case 'sales_manager':
      return '/SalesManagerDashboard';
    default:
      return ONBOARDING_PATH;
  }
}

export function hasDashboardAccess(onboardingState: OnboardingState): boolean {
  return onboardingState === 'active';
}

export interface OnboardingContext {
  status: UserStatus;
  role: DashboardRole | null;
  onboarding_state: OnboardingState;
  redirect_path: string;
}

export function getOnboardingContext(row: UserEntity): OnboardingContext {
  const status = (row.status || 'pending') as UserStatus;
  const role = normalizeUserRole(row.role);
  const onboarding_state = getOnboardingState(status, row.role);
  const redirect_path = getRedirectPath(onboarding_state, role);
  return { status, role, onboarding_state, redirect_path };
}

export function validateBelarusPhone(phone: string): void {
  if (!phone || !phone.trim()) {
    return;
  }
  const digits = phone.replace(/\D/g, '');
  let national = digits;
  if (national.startsWith('375')) {
    national = national.slice(3);
  } else if (national.startsWith('80')) {
    national = national.slice(2);
  }
  if (national.length !== 9) {
    throw new Error('Phone must match format +375 (29) 999-99-99');
  }
}

/**
 * Profile FIO must contain at least two words (e.g. "Иванов Иван").
 * Canonical storage is lastName + firstName (see display-name.util).
 */
export function validateProfileFullName(firstName: string, lastName: string): void {
  const words = `${String(lastName ?? '').trim()} ${String(firstName ?? '').trim()}`
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 2) {
    throw new Error('Full name must contain at least two words');
  }
}
