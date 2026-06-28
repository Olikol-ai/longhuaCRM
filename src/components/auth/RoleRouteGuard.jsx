import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isOnboarding, ONBOARDING_PATH, resolveRedirect } from '@/lib/routing';

const ONBOARDING_PATHS = new Set([ONBOARDING_PATH, '/Welcome']);

function RouteSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );
}

export default function RoleRouteGuard({ children }) {
  const { user, isLoadingAuth, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoadingAuth || !isAuthenticated || !user) {
    return <RouteSpinner />;
  }

  const path = location.pathname;

  if (isOnboarding(user)) {
    if (!ONBOARDING_PATHS.has(path)) {
      return <Navigate to={ONBOARDING_PATH} replace />;
    }
    return children;
  }

  if (ONBOARDING_PATHS.has(path)) {
    return <Navigate to={resolveRedirect(user)} replace />;
  }

  const home = resolveRedirect(user);
  if ((path === '/' || path === '/Dashboard') && path !== home) {
    return <Navigate to={home} replace />;
  }

  return children;
}

export function RoleHomeRedirect({ role }) {
  const paths = {
    admin: '/Dashboard',
    teacher: '/TeacherDashboard',
    student: '/StudentDashboard',
  };
  return <Navigate to={paths[role] || ONBOARDING_PATH} replace />;
}

export function OnboardingFallback() {
  const { user, isLoadingAuth, isAuthenticated } = useAuth();
  if (isLoadingAuth || !isAuthenticated || !user) {
    return <RouteSpinner />;
  }
  return <Navigate to={resolveRedirect(user)} replace />;
}
