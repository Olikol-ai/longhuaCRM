/** Routing helpers — role-based paths after auth is fully resolved.
 *  See docs/frontend-routing.md for how this relates to App.jsx and pages.config.js */

import { isValidDashboardRole } from './auth-gate';

export const ONBOARDING_PATH = '/auth/pending-approval';

export const ROLE_ENTRY_PATHS = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
};

export const ROLE_DASHBOARD_PATHS = {
  admin: '/Dashboard',
  teacher: '/TeacherDashboard',
  student: '/StudentDashboard',
};

const SHARED_PATHS = new Set(['/Profile', '/Settings', '/MaterialsHub']);

export function isOnboarding(user) {
  return user?.onboarding_state === 'needs_verification'
    || user?.onboarding_state === 'awaiting_role'
    || user?.onboarding_state === 'blocked';
}

export function hasDashboardAccess(user) {
  return user?.onboarding_state === 'active' && user?.role != null;
}

/** Canonical post-auth entry for each role — no student fallback. */
export function getRoleHomePath(role) {
  if (role === 'admin' || role === 'teacher' || role === 'student') {
    return ROLE_ENTRY_PATHS[role];
  }
  return ONBOARDING_PATH;
}

export function getRoleDashboardPath(role) {
  if (role === 'admin' || role === 'teacher' || role === 'student') {
    return ROLE_DASHBOARD_PATHS[role];
  }
  return ONBOARDING_PATH;
}

export function resolveRedirect(user) {
  if (!user) return '/login';
  if (isOnboarding(user)) return ONBOARDING_PATH;
  if (!isValidDashboardRole(user.role)) return ONBOARDING_PATH;
  return getRoleHomePath(user.role);
}

export function getPostAuthRedirect(user) {
  return resolveRedirect(user);
}

/** Returns required role for a path, or null if shared/neutral. */
export function getRequiredRoleForPath(pathname) {
  if (SHARED_PATHS.has(pathname)) return null;
  if (pathname === '/' || pathname === '/Welcome') return null;

  if (
    pathname === '/admin'
    || pathname === '/Dashboard'
    || pathname === '/Schedule'
    || pathname === '/UserManagement'
    || pathname === '/AdminPanel'
    || pathname === '/AdminLessonMaterials'
    || pathname === '/Students'
    || pathname === '/students'
    || pathname.startsWith('/StudentDetail')
  ) {
    return 'admin';
  }

  if (
    pathname === '/teacher'
    || pathname === '/TeacherDashboard'
    || pathname === '/TeacherSchedule'
  ) {
    return 'teacher';
  }

  if (
    pathname === '/student'
    || pathname === '/StudentDashboard'
    || pathname === '/StudentLessons'
    || pathname === '/StudentLessonMaterials'
  ) {
    return 'student';
  }

  return null;
}

export function isPathAllowedForUser(user, pathname) {
  const requiredRole = getRequiredRoleForPath(pathname);
  if (!requiredRole) return true;
  if (!isValidDashboardRole(user?.role)) return false;
  if (user.role === requiredRole) return true;
  if (requiredRole === 'teacher' && user.role === 'admin' && pathname === '/MaterialsHub') {
    return true;
  }
  return false;
}
