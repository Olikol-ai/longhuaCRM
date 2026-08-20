import { getToken } from '@/api';
import { PageLoading } from '@/design-system';

const VALID_DASHBOARD_ROLES = new Set(['admin', 'teacher', 'tutor', 'student', 'tutor_student']);

export function AuthLoadingScreen() {
  return <PageLoading fullScreen label="Загрузка сессии" />;
}

export function isValidDashboardRole(role) {
  return VALID_DASHBOARD_ROLES.has(role);
}

/** Detect token/user/auth flag mismatches — never show UI in partial session state. */
export function hasPartialSessionState({ isAuthenticated, user }) {
  const token = getToken();
  if (token && !isAuthenticated) return true;
  if (!token && isAuthenticated) return true;
  if (isAuthenticated && !user) return true;
  if (!isAuthenticated && user) return true;
  if (isAuthenticated && user?.onboarding_state === 'active' && !isValidDashboardRole(user?.role)) {
    return true;
  }
  return false;
}

/** Block all protected UI until establishSession() has finished resolving. */
export function shouldBlockProtectedUI({ isLoadingAuth, isAuthenticated, user }) {
  if (isLoadingAuth) return true;
  if (hasPartialSessionState({ isAuthenticated, user })) return true;
  return false;
}

/** Active dashboard users must have an explicit role — never assume or fallback. */
export function shouldBlockUntilRoleKnown(user) {
  if (!user) return true;
  if (user.onboarding_state !== 'active') return false;
  return !isValidDashboardRole(user.role);
}
