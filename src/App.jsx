import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
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
import RoleRouteGuard, { RoleHomeRedirect, OnboardingFallback } from '@/components/auth/RoleRouteGuard';
import { AdminRoute, TeacherRoute } from '@/components/auth/AdminRoute';
import { ONBOARDING_PATH } from '@/lib/routing';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user, needsNameSetup, handleNameSetupComplete } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
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
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
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
          }

          return <Route key={path} path={`/${path}`} element={element} />;
        })}
        <Route path="/AdminLessonMaterials" element={<AdminRoute><LayoutWrapper currentPageName="AdminLessonMaterials"><AdminLessonMaterials /></LayoutWrapper></AdminRoute>} />
        <Route path="/MaterialsHub" element={<TeacherRoute><LayoutWrapper currentPageName="MaterialsHub"><MaterialsHub /></LayoutWrapper></TeacherRoute>} />
        <Route path="/StudentLessonMaterials" element={<LayoutWrapper currentPageName="StudentLessonMaterials"><StudentLessonMaterials /></LayoutWrapper>} />
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
