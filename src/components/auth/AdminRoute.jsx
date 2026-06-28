import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { resolveRedirect } from '@/lib/routing';

function RouteSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );
}

export function AdminRoute({ children }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return <RouteSpinner />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to={resolveRedirect(user)} replace />;
  }

  return children;
}

export function TeacherRoute({ children, allowAdmin = true }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return <RouteSpinner />;
  }

  const allowed =
    user?.role === 'teacher' || (allowAdmin && user?.role === 'admin');

  if (!allowed) {
    return <Navigate to={resolveRedirect(user)} replace />;
  }

  return children;
}
