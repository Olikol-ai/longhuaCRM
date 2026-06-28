import { getToken } from '@/api';

const VALID_DASHBOARD_ROLES = new Set(['admin', 'teacher', 'student']);

export function AuthLoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );
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
