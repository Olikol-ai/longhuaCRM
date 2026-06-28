import { useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isOnboarding, ONBOARDING_PATH, resolveRedirect } from '@/lib/routing';

const ONBOARDING_PATHS = new Set([ONBOARDING_PATH, '/Welcome']);

export default function RoleRouteGuard({ children }) {
  const { user, isLoadingAuth, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !user) return;

    const path = location.pathname;

    if (isOnboarding(user)) {
      if (!ONBOARDING_PATHS.has(path)) {
        navigate(ONBOARDING_PATH, { replace: true });
      }
      return;
    }

    if (ONBOARDING_PATHS.has(path)) {
      navigate(resolveRedirect(user), { replace: true });
      return;
    }

    const home = resolveRedirect(user);
    if ((path === '/' || path === '/Dashboard') && path !== home) {
      navigate(home, { replace: true });
    }
  }, [user, isLoadingAuth, isAuthenticated, location.pathname, navigate]);

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
  const { user, isLoadingAuth } = useAuth();
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }
  return <Navigate to={resolveRedirect(user)} replace />;
}
