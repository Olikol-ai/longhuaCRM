import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  AuthLoadingScreen,
  shouldBlockProtectedUI,
  shouldBlockUntilRoleKnown,
} from '@/lib/auth-gate';
import ForbiddenPage from '@/pages/Forbidden';
import {
  getRoleDashboardPath,
  isOnboarding,
  isPathForbiddenForUser,
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

  if (isPathForbiddenForUser(user, path)) {
    return (
      <ForbiddenPage
        description={`Страница «${path}» недоступна для роли «${user.role}». Пункт меню скрыт намеренно — прямой URL тоже запрещён.`}
        homePath={home}
      />
    );
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
    return (
      <ForbiddenPage
        description={`Вход «${role}» недоступен для роли «${user.role}».`}
        homePath={resolveRedirect(user)}
      />
    );
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

  if (!isOnboarding(user) && user?.role) {
    return (
      <ForbiddenPage
        description="Запрошенная страница не найдена или недоступна."
        homePath={resolveRedirect(user)}
      />
    );
  }

  return <Navigate to={resolveRedirect(user)} replace />;
}
