import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { AuthLoadingScreen, shouldBlockProtectedUI } from '@/lib/auth-gate';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PendingApproval from './pages/PendingApproval';
import { ThemeProvider } from '@/lib/ThemeContext';
import NameFormModal from '@/components/auth/NameFormModal';
import RoleRouteGuard, { RoleHomeRedirect, OnboardingFallback, RootRedirect } from '@/components/auth/RoleRouteGuard';
import { AdminRoute, TeacherRoute, StudentRoute } from '@/components/auth/AdminRoute';
import { ONBOARDING_PATH } from '@/lib/routing';

const UserManagement = lazy(() => import('./pages/UserManagement'));
const StudentLessonMaterials = lazy(() => import('./pages/StudentLessonMaterials'));
const MaterialsHub = lazy(() => import('./pages/MaterialsHub'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Groups = lazy(() => import('./pages/Groups'));
const GroupDetail = lazy(() => import('./pages/GroupDetail'));
const Certificates = lazy(() => import('./pages/Certificates'));
const StudentCertificates = lazy(() => import('./pages/StudentCertificates'));
const CertificateView = lazy(() => import('./pages/CertificateView'));
const CertificateVerify = lazy(() => import('./pages/CertificateVerify'));
const Payments = lazy(() => import('./pages/Payments'));

/**
 * Route registration: see docs/frontend-routing.md
 * - Public routes: /login, /forgot-password, /reset-password, onboarding
 * - pages.config Pages → /{PageName} with role guards below
 * - Manual admin/teacher/student routes declared after the Pages map
 */

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

/** Old /TeacherPayments bookmarks → AdminPanel (salary) or TeacherDashboard. */
function TeacherPaymentsLegacyRedirect() {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return <Navigate to="/AdminPanel" replace />;
  }
  return <Navigate to="/TeacherDashboard" replace />;
}

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
      <Suspense fallback={<AuthLoadingScreen />}>
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
          } else if (['StudentDashboard', 'StudentLessons', 'StudentCertificates'].includes(path)) {
            element = <StudentRoute>{element}</StudentRoute>;
          }

          return <Route key={path} path={`/${path}`} element={element} />;
        })}
        <Route path="/AdminLessonMaterials" element={<Navigate to="/MaterialsHub" replace />} />
        <Route path="/MaterialsHub" element={<TeacherRoute><LayoutWrapper currentPageName="MaterialsHub"><MaterialsHub /></LayoutWrapper></TeacherRoute>} />
        <Route path="/StudentLessonMaterials" element={<StudentRoute><LayoutWrapper currentPageName="StudentLessonMaterials"><StudentLessonMaterials /></LayoutWrapper></StudentRoute>} />
        <Route path="/UserManagement" element={<AdminRoute><LayoutWrapper currentPageName="UserManagement"><UserManagement /></LayoutWrapper></AdminRoute>} />
        <Route path="/AdminPanel" element={<AdminRoute><LayoutWrapper currentPageName="AdminPanel"><AdminPanel /></LayoutWrapper></AdminRoute>} />
        <Route path="/Groups/:groupId" element={<AdminRoute><LayoutWrapper currentPageName="Groups"><GroupDetail /></LayoutWrapper></AdminRoute>} />
        <Route path="/Groups" element={<AdminRoute><LayoutWrapper currentPageName="Groups"><Groups /></LayoutWrapper></AdminRoute>} />
        <Route path="/Certificates" element={<AdminRoute><LayoutWrapper currentPageName="Certificates"><Certificates /></LayoutWrapper></AdminRoute>} />
        <Route path="/StudentCertificates" element={<StudentRoute><LayoutWrapper currentPageName="StudentCertificates"><StudentCertificates /></LayoutWrapper></StudentRoute>} />
        <Route path="/certificate/:id" element={<CertificateView />} />
        <Route path="/Attendance" element={<Navigate to="/Groups" replace />} />
        <Route path="/Payments" element={<AdminRoute><LayoutWrapper currentPageName="Payments"><Payments /></LayoutWrapper></AdminRoute>} />
        <Route path="/LessonSeriesAdmin" element={<Navigate to="/Groups" replace />} />
        <Route path="/TeacherPayments" element={<TeacherPaymentsLegacyRedirect />} />
        <Route path="*" element={<OnboardingFallback />} />
      </Routes>
      </Suspense>
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
              <Route path="/register" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path={ONBOARDING_PATH} element={<PendingApproval />} />
              <Route
                path="/verify/certificate/:id"
                element={(
                  <Suspense fallback={<AuthLoadingScreen />}>
                    <CertificateVerify />
                  </Suspense>
                )}
              />
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
