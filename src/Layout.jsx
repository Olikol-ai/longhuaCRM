import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  ChevronRight,
  UserCircle,
  Sun,
  Moon,
  Layers,
} from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const adminNav = [
  { name: "Главная", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Расписание", icon: Calendar, page: "Schedule" },
  { name: "Панель управления", icon: Layers, page: "AdminPanel" },
  { name: "Материалы", icon: BookOpen, page: "MaterialsHub" },
  { name: "Пользователи", icon: Users, page: "UserManagement" },
  { name: "Настройки", icon: Settings, page: "Settings" },
];

const teacherNav = [
  { name: "Главная", icon: LayoutDashboard, page: "TeacherDashboard" },
  { name: "Моё расписание", icon: Calendar, page: "TeacherSchedule" },
  { name: "Материалы", icon: BookOpen, page: "MaterialsHub" },
  { name: "Профиль", icon: UserCircle, page: "Profile" },
  { name: "Настройки", icon: Settings, page: "Settings" },
];

const studentNav = [
  { name: "Главная", icon: LayoutDashboard, page: "StudentDashboard" },
  { name: "Мои уроки", icon: Calendar, page: "StudentLessons" },
  { name: "Мои материалы", icon: BookOpen, page: "StudentLessonMaterials" },
  { name: "Профиль", icon: UserCircle, page: "Profile" },
  { name: "Настройки", icon: Settings, page: "Settings" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, isLoadingAuth, isAuthenticated, logout } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 p-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BookOpen className="h-10 w-10 text-indigo-600" />
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Longhua Chinese</h1>
          </div>
          <p className="text-muted-foreground max-w-sm">Платформа управления языковой школой</p>
          <Button
            onClick={() => { window.location.href = '/login'; }}
            className="bg-indigo-600 hover:bg-indigo-700 px-8 py-3 text-base"
          >
            Войти
          </Button>
        </div>
      </div>
    );
  }

  const role = user.role || "pending";

  if ((role === "pending" || role === "user") && currentPageName !== "Welcome") {
    navigate(createPageUrl("Welcome"), { replace: true });
    return null;
  }

  if (currentPageName === "Welcome" && role !== "pending" && role !== "user") {
    const dest = role === "admin" ? "Dashboard" : role === "teacher" ? "TeacherDashboard" : "StudentDashboard";
    navigate(createPageUrl(dest), { replace: true });
    return null;
  }

  if (role === "student" && currentPageName === "Dashboard") {
    navigate(createPageUrl("StudentDashboard"), { replace: true });
    return null;
  }

  if (currentPageName === "Welcome") {
    return <>{children}</>;
  }

  const navItems = role === "admin" ? adminNav : role === "teacher" ? teacherNav : studentNav;

  const fullName = user?.full_name || user?.email || "User";

  const initials = (fullName || "U")
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
       fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-700
       transform transition-transform duration-200 ease-in-out
       ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
       flex flex-col
      `}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Longhua</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="hidden lg:flex p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Переключить тему"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button className="lg:hidden text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  }
                `}
              >
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-white" : "text-slate-600 dark:text-slate-400"}`} />
                <span className="text-[13px]">{item.name}</span>
                {isActive && <ChevronRight className="h-4 w-4 ml-auto text-white" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{fullName}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {role === "admin" ? "Администратор" : role === "teacher" ? "Преподаватель" : role === "student" ? "Ученик" : "Ожидает роли"}
              </p>
            </div>
            <button onClick={logout} className="text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="text-slate-600 dark:text-slate-400">
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold text-slate-900 dark:text-white">Longhua</span>
          </div>
          <button onClick={toggleTheme} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
