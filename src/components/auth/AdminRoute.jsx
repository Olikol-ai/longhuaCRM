import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { AuthLoadingScreen, shouldBlockProtectedUI } from '@/lib/auth-gate';
import { resolveRedirect } from '@/lib/routing';

function blockRoute(auth) {
  return shouldBlockProtectedUI(auth);
}

export function AdminRoute({ children }) {
  const auth = useAuth();
  const { user } = auth;

  if (blockRoute(auth)) {
    return <AuthLoadingScreen />;
  }

  if (user.role !== 'admin') {
    return <Navigate to={resolveRedirect(user)} replace />;
  }

  return children;
}

export function TeacherRoute({ children, allowAdmin = true, allowTutor = false }) {
  const auth = useAuth();
  const { user } = auth;

  if (blockRoute(auth)) {
    return <AuthLoadingScreen />;
  }

  const allowed =
    user.role === 'teacher' ||
    (allowTutor && user.role === 'tutor') ||
    (allowAdmin && user.role === 'admin');

  if (!allowed) {
    return <Navigate to={resolveRedirect(user)} replace />;
  }

  return children;
}

export function StudentRoute({ children, allowTutorStudent = false }) {
  const auth = useAuth();
  const { user } = auth;

  if (blockRoute(auth)) {
    return <AuthLoadingScreen />;
  }

  const allowed = user.role === 'student' || (allowTutorStudent && user.role === 'tutor_student');

  if (!allowed) {
    return <Navigate to={resolveRedirect(user)} replace />;
  }

  return children;
}

export function TutorRoute({ children, allowAdmin = true }) {
  const auth = useAuth();
  const { user } = auth;

  if (blockRoute(auth)) {
    return <AuthLoadingScreen />;
  }

  const allowed =
    user.role === 'tutor' || (allowAdmin && user.role === 'admin');

  if (!allowed) {
    return <Navigate to={resolveRedirect(user)} replace />;
  }

  return children;
}
