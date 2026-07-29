import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { AuthLoadingScreen, shouldBlockProtectedUI } from '@/lib/auth-gate';
import ForbiddenPage from '@/pages/Forbidden';
import { isPathAllowedForUser, resolveRedirect } from '@/lib/routing';

function blockRoute(auth) {
  return shouldBlockProtectedUI(auth);
}

/**
 * SPA route guard. Prefer this over ad-hoc role checks.
 * Deny → Forbidden page (403 UX), not silent menu hiding.
 */
export function RoleGuard({ roles, children, mode = 'forbidden' }) {
  const auth = useAuth();
  const { user } = auth;
  const location = useLocation();

  if (blockRoute(auth)) {
    return <AuthLoadingScreen />;
  }

  const allowedList = Array.isArray(roles) ? roles : [];
  const allowed = allowedList.includes(user.role);

  if (!allowed) {
    if (mode === 'redirect') {
      return (
        <Navigate
          to={resolveRedirect(user)}
          replace
          state={{
            forbidden: true,
            from: location.pathname,
            message: 'Недостаточно прав для этой страницы',
          }}
        />
      );
    }
    return (
      <ForbiddenPage
        description={`Страница «${location.pathname}» недоступна для роли «${user.role}».`}
      />
    );
  }

  return children;
}

/** Guard by current pathname using the central ROUTE_ACCESS map. */
export function PathAccessGuard({ children, mode = 'forbidden' }) {
  const auth = useAuth();
  const { user } = auth;
  const location = useLocation();

  if (blockRoute(auth)) {
    return <AuthLoadingScreen />;
  }

  if (!isPathAllowedForUser(user, location.pathname)) {
    if (mode === 'redirect') {
      return (
        <Navigate
          to={resolveRedirect(user)}
          replace
          state={{
            forbidden: true,
            from: location.pathname,
            message: 'Недостаточно прав для этой страницы',
          }}
        />
      );
    }
    return (
      <ForbiddenPage
        description={`Страница «${location.pathname}» недоступна для роли «${user.role}».`}
      />
    );
  }

  return children;
}

export function AdminRoute({ children }) {
  return <RoleGuard roles={['admin']}>{children}</RoleGuard>;
}

export function TeacherRoute({ children, allowAdmin = true, allowTutor = false }) {
  const roles = ['teacher'];
  if (allowTutor) roles.push('tutor');
  if (allowAdmin) roles.push('admin');
  return <RoleGuard roles={roles}>{children}</RoleGuard>;
}

export function StudentRoute({ children, allowTutorStudent = false }) {
  const roles = ['student'];
  if (allowTutorStudent) roles.push('tutor_student');
  return <RoleGuard roles={roles}>{children}</RoleGuard>;
}

export function TutorRoute({ children, allowAdmin = true }) {
  const roles = ['tutor'];
  if (allowAdmin) roles.push('admin');
  return <RoleGuard roles={roles}>{children}</RoleGuard>;
}
