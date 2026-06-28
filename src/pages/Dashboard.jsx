import { useAuth } from "@/lib/AuthContext";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import TeacherDashboard from "@/components/dashboard/TeacherDashboard";

export default function Dashboard() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const role = user?.role || "pending";

  if (role === "admin") return <AdminDashboard user={user} />;
  if (role === "teacher") return <TeacherDashboard user={user} />;

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
