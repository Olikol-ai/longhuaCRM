import React from "react";
import { Link } from "react-router-dom";
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
  Award,
  ClipboardList,
  CreditCard,
  NotebookPen,
  MessageSquare,
} from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { useAuth } from "@/lib/AuthContext";
import {
  AuthLoadingScreen,
  isValidDashboardRole,
  shouldBlockProtectedUI,
  shouldBlockUntilRoleKnown,
} from "@/lib/auth-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildUserAvatarUrl } from "@/api/http";
import { connectChatSocket, subscribeToChatSocket } from "@/lib/chat-socket";
import { subscribeChatUnreadTotal } from "@/lib/chat-unread-events";
import {
  applyUnreadSummaryFromSocket,
  refreshChatUnread,
  UNREAD_POLL_INTERVAL_MS,
} from "@/lib/chat-unread-sync";

const adminNav = [
  { name: "Главная", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Чаты", icon: MessageSquare, page: "Chats" },
  { name: "Расписание", icon: Calendar, page: "Schedule" },
  { name: "Панель управления", icon: Layers, page: "AdminPanel" },
  { name: "Пользователи", icon: Users, page: "UserManagement" },
  { name: "Группы", icon: Users, page: "Groups" },
  { name: "Сертификаты", icon: Award, page: "Certificates" },
  { name: "Платежи", icon: CreditCard, page: "Payments" },
  { name: "Материалы", icon: BookOpen, page: "MaterialsHub" },
  { name: "HSK Academy", icon: Award, page: "HskAcademy" },
  { name: "Студия HSK", icon: BookOpen, page: "ExamContent" },
  { name: "Проверочные работы", icon: ClipboardList, page: "AdminAssessment" },
  { name: "Настройки", icon: Settings, page: "Settings" },
];

const teacherNav = [
  { name: "Главная", icon: LayoutDashboard, page: "TeacherDashboard" },
  { name: "Чаты", icon: MessageSquare, page: "Chats" },
  { name: "Моё расписание", icon: Calendar, page: "TeacherSchedule" },
  { name: "Ученики", icon: Users, page: "TeacherStudents" },
  { name: "HSK Academy", icon: Award, page: "HskAcademy" },
  { name: "Студия HSK", icon: BookOpen, page: "ExamContent" },
  { name: "Экзамены", icon: ClipboardList, page: "TeacherAssessment" },
  { name: "Мои вопросы", icon: BookOpen, page: "AssessmentQuestions" },
  { name: "Мои экзамены", icon: ClipboardList, page: "AssessmentExams" },
  { name: "Домашние задания", icon: NotebookPen, page: "HomeworkList" },
  { name: "Материалы", icon: BookOpen, page: "MaterialsHub" },
  { name: "Профиль", icon: UserCircle, page: "Profile" },
  { name: "Настройки", icon: Settings, page: "Settings" },
];

const tutorNav = [
  { name: "Главная", icon: LayoutDashboard, page: "TutorDashboard" },
  { name: "Чаты", icon: MessageSquare, page: "Chats" },
  { name: "Расписание", icon: Calendar, page: "TutorSchedule" },
  { name: "Ученики", icon: Users, page: "TutorStudents" },
  { name: "Мои вопросы", icon: BookOpen, page: "AssessmentQuestions" },
  { name: "Мои экзамены", icon: ClipboardList, page: "AssessmentExams" },
  { name: "Домашние задания", icon: NotebookPen, page: "HomeworkList" },
  { name: "Материалы", icon: BookOpen, page: "MaterialsHub" },
  { name: "Ссылки", icon: BookOpen, page: "TutorReferralLinks" },
  { name: "Статистика", icon: ClipboardList, page: "TutorStats" },
  { name: "Профиль", icon: UserCircle, page: "TutorProfile" },
  { name: "Настройки", icon: Settings, page: "Settings" },
];

const studentNav = [
  { name: "Главная", icon: LayoutDashboard, page: "StudentDashboard" },
  { name: "Чаты", icon: MessageSquare, page: "Chats" },
  { name: "Мои уроки", icon: Calendar, page: "StudentLessons" },
  { name: "Мои материалы", icon: BookOpen, page: "StudentLessonMaterials" },
  { name: "HSK Academy", icon: Award, page: "HskAcademy" },
  { name: "Мои сертификаты", icon: Award, page: "StudentCertificates" },
  { name: "Мои экзамены", icon: ClipboardList, page: "StudentExams" },
  { name: "Домашние задания", icon: NotebookPen, page: "HomeworkViewer" },
  { name: "Профиль", icon: UserCircle, page: "Profile" },
  { name: "Настройки", icon: Settings, page: "Settings" },
];

const tutorStudentNav = [
  { name: "Чаты", icon: MessageSquare, page: "Chats" },
  { name: "Домашние задания", icon: NotebookPen, page: "HomeworkViewer" },
  { name: "Профиль", icon: UserCircle, page: "Profile" },
  { name: "Настройки", icon: Settings, page: "Settings" },
];

const NAV_BY_ROLE = {
  admin: adminNav,
  teacher: teacherNav,
  tutor: tutorNav,
  student: studentNav,
  tutor_student: tutorStudentNav,
};

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [chatUnread, setChatUnread] = React.useState(0);
  const { theme, toggleTheme } = useTheme();
  const auth = useAuth();
  const { user, isAuthenticated, logout } = auth;

  React.useEffect(() => {
    if (!sidebarOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sidebarOpen]);

  React.useEffect(() => {
    if (!isAuthenticated) return undefined;

    // Badge sync is background-only — never gate page/material navigation on it.
    void refreshChatUnread({ force: true });
    connectChatSocket();

    const interval = window.setInterval(() => {
      void refreshChatUnread();
    }, UNREAD_POLL_INTERVAL_MS);

    // Throttled inside refreshChatUnread — window.open (materials) must not stampede HTTP.
    const onFocus = () => {
      void refreshChatUnread();
    };
    window.addEventListener('focus', onFocus);

    const unsubLocal = subscribeChatUnreadTotal((total) => setChatUnread(total));
    const unsubSocket = subscribeToChatSocket({
      'chat.unread': (payload) => {
        applyUnreadSummaryFromSocket(payload);
      },
      // Live unread arrives via chat.unread fan-out — do not HTTP-refresh on every message.
    });

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      unsubLocal();
      unsubSocket();
    };
  }, [isAuthenticated]);

  if (shouldBlockProtectedUI(auth)) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    return <AuthLoadingScreen />;
  }

  const role = user.role;
  const hasDashboard = user.onboarding_state === 'active' && isValidDashboardRole(role);

  if (currentPageName === 'Welcome' || currentPageName === 'PendingApproval' || !hasDashboard) {
    return <>{children}</>;
  }

  // Full-bleed lesson video shell — no CRM sidebar; video owns the viewport.
  // Do not force dark theme here — LessonVideo follows ThemeContext.
  if (currentPageName === 'LessonVideo') {
    return (
      <div className="h-dvh max-h-dvh overflow-hidden bg-background">
        {children}
      </div>
    );
  }

  if (shouldBlockUntilRoleKnown(user)) {
    return <AuthLoadingScreen />;
  }

  const navItems = NAV_BY_ROLE[role];
  if (!navItems) {
    return <AuthLoadingScreen />;
  }

  const fullName = user?.full_name || user?.email || "User";

  const initials = (fullName || "U")
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avatarSrc =
    user?.has_avatar || user?.avatar_updated_at
      ? buildUserAvatarUrl(user.id, {
          thumb: true,
          version: user.avatar_updated_at || 0,
        })
      : null;

  return (
    <div className="min-h-app bg-background text-foreground overflow-x-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/*
        Sidebar is always position:fixed (viewport).
        Mobile: off-canvas drawer (-translate-x-full until open).
        Desktop (lg+): always visible; main column uses lg:pl-64 so content is not covered.
        PWA / iOS: safe-pt / safe-pb keep chrome clear of Dynamic Island & home indicator.
      */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-app max-h-app
          w-[min(16rem,85vw)] lg:w-64
          bg-card border-r border-border
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
          flex flex-col shadow-xl lg:shadow-none
          safe-pt safe-pb
        `}
      >
        <div className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center bg-brand-soft text-brand">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight truncate">Longhua</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="hidden lg:flex p-2 min-h-touch min-w-touch items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-brand-soft hover:text-brand transition-colors"
              title="Переключить тему"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="lg:hidden p-2 min-h-touch min-w-touch inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg"
              onClick={() => setSidebarOpen(false)}
              aria-label="Закрыть меню"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overscroll-contain min-h-0">
          {navItems.map((item) => {
            const assessmentWorkspacePages = [
              'AdminAssessment',
              'AssessmentQuestions',
              'AssessmentExams',
              'AssessmentExamDetail',
              'AssessmentAssignments',
              'AssessmentAssignmentDetail',
              'AssessmentResults',
              'AssessmentResultDetail',
              'HomeworkList',
              'HomeworkEditor',
              'HomeworkAssignment',
              'HomeworkResults',
            ];
            const isActive =
              currentPageName === item.page ||
              (item.page === 'AdminAssessment' &&
                assessmentWorkspacePages.includes(currentPageName));
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium transition-all
                  ${isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-brand-soft hover:text-brand"
                  }
                `}
              >
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-primary-foreground" : ""}`} />
                <span className="text-[13px] truncate">{item.name}</span>
                {item.page === 'Chats' && chatUnread > 0 ? (
                  <span className={`ml-auto flex min-w-4 h-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${isActive ? 'bg-primary-foreground text-primary' : 'bg-brand text-white'}`}>
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                ) : null}
                {isActive && <ChevronRight className="h-4 w-4 ml-auto shrink-0 text-primary-foreground" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3 shrink-0">
          <div className="flex items-center gap-3 px-2 sm:px-3 py-2">
            <Avatar className="h-8 w-8 shrink-0">
              {avatarSrc ? (
                <AvatarImage src={avatarSrc} alt="" className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-brand-soft text-brand text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {role === "admin" ? "Администратор" : role === "teacher" ? "Преподаватель" : role === "tutor" ? "Репетитор" : role === "student" ? "Ученик" : "Ожидает роли"}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-2 min-h-touch min-w-touch inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0 rounded-lg"
              aria-label="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-col min-h-app min-w-0 w-full max-w-full lg:pl-64">
        <header className="lg:hidden sticky top-0 z-30 shrink-0 bg-card border-b border-border safe-pt">
          <div className="h-14 flex items-center justify-between px-3 sm:px-4 safe-px">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-1 min-h-touch min-w-touch inline-flex items-center justify-center text-muted-foreground rounded-lg hover:bg-brand-soft hover:text-brand"
                aria-label="Открыть меню"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="font-semibold text-foreground truncate">Longhua</span>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 min-h-touch min-w-touch inline-flex items-center justify-center text-muted-foreground hover:text-brand transition-colors rounded-lg"
              aria-label="Переключить тему"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden safe-pb">
          {children}
        </main>
      </div>
    </div>
  );
}
