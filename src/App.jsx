import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { AuthLoadingScreen, shouldBlockProtectedUI } from '@/lib/auth-gate';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AdminLessonMaterials from './pages/AdminLessonMaterials';
import UserManagement from './pages/UserManagement';
import StudentLessonMaterials from './pages/StudentLessonMaterials';
import MaterialsHub from './pages/MaterialsHub';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';
import PendingApproval from './pages/PendingApproval';
import { ThemeProvider } from '@/lib/ThemeContext';
import NameFormModal from '@/components/auth/NameFormModal';
import RoleRouteGuard, { RoleHomeRedirect, OnboardingFallback, RootRedirect } from '@/components/auth/RoleRouteGuard';
import { AdminRoute, TeacherRoute, StudentRoute } from '@/components/auth/AdminRoute';
import { ONBOARDING_PATH } from '@/lib/routing';

const { Pages, Layout } = pagesConfig;

const LayoutWrapper = ({ children, currentPageName }) => {
  const auth = useAuth();
  if (shouldBlockProtectedUI(auth)) {
    return <AuthLoadingScreen />;
  }
  return Layout ?
    <Layout currentPageName={currentPageName}>{children}</Layout>
    : <>{children}</>;
};

const AuthenticatedApp = () => {
  const auth = useAuth();
  const {
    isLoadingPublicSettings,
    authError,
    navigateToLogin,
    user,
    isAuthenticated,
    needsNameSetup,
    handleNameSetupComplete,
  } = auth;

  if (isLoadingPublicSettings || shouldBlockProtectedUI(auth)) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    navigateToLogin();
    return null;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  if (needsNameSetup && user) {
    return <NameFormModal user={user} onSave={handleNameSetupComplete} />;
  }

  return (
    <RoleRouteGuard>
      <Routes>
        <Route path={ONBOARDING_PATH} element={<PendingApproval />} />
        <Route path="/Welcome" element={<Navigate to={ONBOARDING_PATH} replace />} />
        <Route path="/student" element={<RoleHomeRedirect role="student" />} />
        <Route path="/teacher" element={<RoleHomeRedirect role="teacher" />} />
        <Route path="/admin" element={<RoleHomeRedirect role="admin" />} />
        <Route path="/Students" element={<Navigate to="/UserManagement" replace />} />
        <Route path="/students" element={<Navigate to="/UserManagement" replace />} />
        <Route path="/" element={<RootRedirect />} />
        {Object.entries(Pages).map(([path, Page]) => {
          let element = (
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          );

          if (['Dashboard', 'Schedule', 'StudentDetail'].includes(path)) {
            element = <AdminRoute>{element}</AdminRoute>;
          } else if (['TeacherDashboard', 'TeacherSchedule'].includes(path)) {
            element = <TeacherRoute>{element}</TeacherRoute>;
          } else if (['StudentDashboard', 'StudentLessons'].includes(path)) {
            element = <StudentRoute>{element}</StudentRoute>;
          }

          return <Route key={path} path={`/${path}`} element={element} />;
        })}
        <Route path="/AdminLessonMaterials" element={<AdminRoute><LayoutWrapper currentPageName="AdminLessonMaterials"><AdminLessonMaterials /></LayoutWrapper></AdminRoute>} />
        <Route path="/MaterialsHub" element={<TeacherRoute><LayoutWrapper currentPageName="MaterialsHub"><MaterialsHub /></LayoutWrapper></TeacherRoute>} />
        <Route path="/StudentLessonMaterials" element={<StudentRoute><LayoutWrapper currentPageName="StudentLessonMaterials"><StudentLessonMaterials /></LayoutWrapper></StudentRoute>} />
        <Route path="/UserManagement" element={<AdminRoute><LayoutWrapper currentPageName="UserManagement"><UserManagement /></LayoutWrapper></AdminRoute>} />
        <Route path="/AdminPanel" element={<AdminRoute><LayoutWrapper currentPageName="AdminPanel"><AdminPanel /></LayoutWrapper></AdminRoute>} />
        <Route path="*" element={<OnboardingFallback />} />
      </Routes>
    </RoleRouteGuard>
  );
};


function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path={ONBOARDING_PATH} element={<PendingApproval />} />
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App
