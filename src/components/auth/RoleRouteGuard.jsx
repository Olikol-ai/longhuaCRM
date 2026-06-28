import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  AuthLoadingScreen,
  shouldBlockProtectedUI,
  shouldBlockUntilRoleKnown,
} from '@/lib/auth-gate';
import {
  getRoleDashboardPath,
  getRequiredRoleForPath,
  isOnboarding,
  isPathAllowedForUser,
  ONBOARDING_PATH,
  resolveRedirect,
} from '@/lib/routing';

const ONBOARDING_PATHS = new Set([ONBOARDING_PATH, '/Welcome']);

function blockProtectedUi(auth) {
  return shouldBlockProtectedUI(auth) || shouldBlockUntilRoleKnown(auth.user);
}

/** Single post-auth routing gate — no route or layout renders until session + role are resolved. */
export default function RoleRouteGuard({ children }) {
  const auth = useAuth();
  const { user } = auth;
  const location = useLocation();

  if (shouldBlockProtectedUI(auth)) {
    return <AuthLoadingScreen />;
  }

  const path = location.pathname;

  if (isOnboarding(user)) {
    if (!ONBOARDING_PATHS.has(path)) {
      return <Navigate to={ONBOARDING_PATH} replace />;
    }
    return children;
  }

  if (shouldBlockUntilRoleKnown(user)) {
    return <AuthLoadingScreen />;
  }

  if (ONBOARDING_PATHS.has(path)) {
    return <Navigate to={resolveRedirect(user)} replace />;
  }

  const home = resolveRedirect(user);

  if (path === '/') {
    return <Navigate to={home} replace />;
  }

  const requiredRole = getRequiredRoleForPath(path);
  if (requiredRole && user.role !== requiredRole && !isPathAllowedForUser(user, path)) {
    return <Navigate to={home} replace />;
  }

  return children;
}

export function RoleHomeRedirect({ role }) {
  const auth = useAuth();
  const { user } = auth;

  if (blockProtectedUi(auth)) {
    return <AuthLoadingScreen />;
  }

  if (user.role !== role) {
    return <Navigate to={resolveRedirect(user)} replace />;
  }

  return <Navigate to={getRoleDashboardPath(role)} replace />;
}

export function RootRedirect() {
  const auth = useAuth();
  const { user } = auth;

  if (blockProtectedUi(auth)) {
    return <AuthLoadingScreen />;
  }

  return <Navigate to={resolveRedirect(user)} replace />;
}

export function OnboardingFallback() {
  const auth = useAuth();
  const { user } = auth;

  if (shouldBlockProtectedUI(auth)) {
    return <AuthLoadingScreen />;
  }

  if (!isOnboarding(user) && shouldBlockUntilRoleKnown(user)) {
    return <AuthLoadingScreen />;
  }

  return <Navigate to={resolveRedirect(user)} replace />;
}
