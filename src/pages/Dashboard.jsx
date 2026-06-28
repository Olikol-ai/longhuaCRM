import { useAuth } from "@/lib/AuthContext";
import { AuthLoadingScreen, isValidDashboardRole, shouldBlockProtectedUI } from "@/lib/auth-gate";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import TeacherDashboard from "@/components/dashboard/TeacherDashboard";

export default function Dashboard() {
  const auth = useAuth();
  const { user } = auth;

  if (shouldBlockProtectedUI(auth)) {
    return (
      <div className="flex items-center justify-center h-full">
        <AuthLoadingScreen />
      </div>
    );
  }

  if (!isValidDashboardRole(user?.role)) {
    return (
      <div className="flex items-center justify-center h-full">
        <AuthLoadingScreen />
      </div>
    );
  }

  if (user.role === "admin") return <AdminDashboard user={user} />;
  if (user.role === "teacher") return <TeacherDashboard user={user} />;

  return (
    <div className="flex flex-col items-center justify-center h-full py-24 gap-4 px-6 dark:bg-slate-950">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Аккаунт ожидает подтверждения</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm">Ваш аккаунт создан, но ещё не получил роль. Администратор школы должен назначить вам роль (ученик или преподаватель). Пожалуйста, свяжитесь с администратором.</p>
      </div>
    </div>
  );
}
