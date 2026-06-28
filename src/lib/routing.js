/** Routing helpers — all decisions come from backend `onboarding_state` + `redirect_path`. */

export const ONBOARDING_PATH = '/auth/pending-approval';

export function resolveRedirect(user) {
  if (!user) return '/login';
  return user.redirect_path || ONBOARDING_PATH;
}

export function isOnboarding(user) {
  return user?.onboarding_state === 'needs_verification'
    || user?.onboarding_state === 'awaiting_role'
    || user?.onboarding_state === 'blocked';
}

export function hasDashboardAccess(user) {
  return user?.onboarding_state === 'active' && user?.role != null;
}

/** @deprecated use user.redirect_path from backend */
export function getRoleHomePath(role) {
  switch (role) {
    case 'admin': return '/Dashboard';
    case 'teacher': return '/TeacherDashboard';
    case 'student': return '/StudentDashboard';
    default: return ONBOARDING_PATH;
  }
}

export function getPostAuthRedirect(user) {
  return resolveRedirect(user);
}
