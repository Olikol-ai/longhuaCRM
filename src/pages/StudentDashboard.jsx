import React, { useState, useEffect, useRef } from "react";
import { api } from '@/api';
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar, BookOpen, GraduationCap, Video, Clock, Loader2, Plus, ChevronDown, ChevronUp, List, Sun, Moon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/dashboard/StatCard";
import TopUpModal from "@/components/student/TopUpModal";
import { useAuth } from "@/lib/AuthContext";
import { formatWelcomeGreeting, getGreetingName } from "@/lib/display-name";
import { useTheme } from "@/lib/ThemeContext";
import { resolveAssignedTeacherLabel, resolveLessonTeacherLabel } from "@/lib/teacherLabels";
import { isOnlineLesson, lessonVideoPath } from "@/lib/lesson-video";

const STATUS_LABELS = {
  planned: "Запланировано",
  completed: "Завершено",
  cancelled: "Отменено",
  rescheduled: "Перенесено",
  missed: "Пропущено",
};

const STATUS_COLORS = {
  planned: "bg-brand-soft text-brand dark:bg-brand-soft/50 dark:text-brand",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  cancelled: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400",
  rescheduled: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  missed: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
};

export default function StudentDashboard() {
  const { user, isLoadingAuth, establishSession } = useAuth();
  const [student, setStudent] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [upcomingExpanded, setUpcomingExpanded] = useState(true);
  const [viewMode, setViewMode] = useState("list"); // "list" | "calendar"
  const [sortAsc, setSortAsc] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const refreshedSessionRef = useRef(false);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const run = async () => {
      if (!refreshedSessionRef.current) {
        refreshedSessionRef.current = true;
        await establishSession?.({ force: true });
      }
      await loadData();
    };
    void run();
  }, [user?.id, isLoadingAuth]);

  const loadData = async () => {
    if (!user) return;
    const [myStudents, allLessons, allTeachers] = await Promise.all([
      api.students.filter({ user_id: user.id }),
      api.lessons.list("-date", 200),
      api.teachers.list(),
    ]);
    const s = myStudents[0] || null;
    setStudent(s);
    setTeachers(allTeachers);
    if (s) {
      setLessons(allLessons.filter((l) =>
        l.primary_student_id === s.id ||
        l.student_id === s.id ||
        (l.student_ids || []).includes(s.id)
      ));
      if (s.assigned_teacher) {
        setTeacher(allTeachers.find((t) => t.id === s.assigned_teacher));
      } else {
        setTeacher(null);
      }
    }
    setLoading(false);
  };

  if (loading || isLoadingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center py-20">
        <p className="text-slate-500 dark:text-slate-400">Профиль ученика не найден для вашего аккаунта.</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Обратитесь к администратору.</p>
      </div>
    );
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const upcoming = lessons
    .filter((l) => l.date >= todayStr && l.status === "planned")
    .sort((a, b) => {
      const cmp = `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`);
      return sortAsc ? cmp : -cmp;
    });
  const completedCount = lessons.filter((l) => l.status === "completed").length;

  // Calendar view helpers
  const calendarDays = (() => {
    if (upcoming.length === 0) return [];
    const grouped = {};
    upcoming.forEach((l) => {
      if (!grouped[l.date]) grouped[l.date] = [];
      grouped[l.date].push(l);
    });
    return Object.entries(grouped).sort(([a], [b]) => (sortAsc ? a.localeCompare(b) : b.localeCompare(a)));
  })();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatWelcomeGreeting(
              getGreetingName(student) ? student : getGreetingName(user) ? user : null,
            )}{' '}
            👋
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: ru })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Сменить тему">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setShowTopUp(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Пополнить баланс
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Баланс уроков"
          value={student.lesson_balance || 0}
          icon={BookOpen}
          color={(student.lesson_balance || 0) <= 2 ? "rose" : "emerald"}
        />
        <StatCard title="Предстоящие уроки" value={upcoming.length} icon={Calendar} color="brand" />
        <StatCard title="Завершённые уроки" value={completedCount} icon={Clock} color="muted" />
      </div>

      {/* Teacher card */}
      <Card className="p-4 mb-8 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
          <GraduationCap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Ваш преподаватель</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {resolveAssignedTeacherLabel(student.assigned_teacher, teachers)}
          </p>
          {teacher?.specializations && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{teacher.specializations}</p>
          )}
        </div>
      </Card>

      {/* Upcoming lessons section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <button
            className="flex items-center gap-2 group"
            onClick={() => setUpcomingExpanded((v) => !v)}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Предстоящие уроки</h2>
            {upcomingExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400" />
            )}
          </button>

          {upcomingExpanded && (
            <div className="flex items-center gap-2">
              {/* Sort toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortAsc((v) => !v)}
                className="text-xs h-8 gap-1"
              >
                {sortAsc ? "↑ Сначала ближайшие" : "↓ Сначала дальние"}
              </Button>
              {/* View toggle */}
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white dark:bg-slate-900 shadow-sm text-brand dark:text-brand" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"}`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "calendar" ? "bg-white dark:bg-slate-900 shadow-sm text-brand dark:text-brand" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"}`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {upcomingExpanded && (
          <>
            {upcoming.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Предстоящих уроков нет</p>
              </Card>
            ) : viewMode === "list" ? (
              <div className="space-y-3">
                {upcoming.map((lesson) => (
                  <Card key={lesson.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[64px] bg-brand-soft dark:bg-brand-soft/40 rounded-xl py-2">
                          <p className="text-[11px] text-brand dark:text-brand font-medium uppercase">
                            {format(new Date(lesson.date), "MMM", { locale: ru })}
                          </p>
                          <p className="text-2xl font-bold text-brand dark:text-brand leading-tight">
                            {format(new Date(lesson.date), "d")}
                          </p>
                          <p className="text-[11px] text-brand dark:text-brand">
                            {format(new Date(lesson.date), "EEE", { locale: ru })}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{lesson.start_time}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{resolveLessonTeacherLabel(lesson, teachers)}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{lesson.duration || 60} мин</p>
                          {lesson.notes && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{lesson.notes}</p>}
                        </div>
                      </div>
                      {isOnlineLesson(lesson) && (
                        <a
                          href={lessonVideoPath(lesson.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-soft dark:bg-brand-soft/40 text-brand dark:text-brand rounded-xl text-sm font-medium hover:bg-brand-muted dark:hover:bg-brand-soft/60 transition-colors shrink-0"
                        >
                          <Video className="h-4 w-4" />
                          Войти в видеоурок
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              /* Calendar view */
              <div className="space-y-4">
                {calendarDays.map(([dateStr, dayLessons]) => (
                  <div key={dateStr}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold">
                        {format(new Date(dateStr), "d")}
                      </div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">
                        {format(new Date(dateStr), "EEEE, d MMMM", { locale: ru })}
                      </p>
                      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                    </div>
                    <div className="ml-11 space-y-2">
                      {dayLessons.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand/30 hover:shadow-sm transition-all">
                          <div className="w-14 text-center">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{lesson.start_time}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{lesson.duration || 60} мин</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{resolveLessonTeacherLabel(lesson, teachers)}</p>
                            {lesson.notes && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{lesson.notes}</p>}
                          </div>
                          {isOnlineLesson(lesson) && (
                            <a
                              href={lessonVideoPath(lesson.id)}
                              className="flex items-center gap-1 text-[11px] text-brand dark:text-brand hover:underline shrink-0"
                            >
                              <Video className="h-3 w-3" /> Войти в видеоурок
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lesson History */}
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">История уроков</h2>
      <div className="space-y-2">
        {lessons
          .filter((l) => l.status === "completed" || l.status === "cancelled" || l.status === "missed")
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
          .slice(0, 15)
          .map((lesson) => (
            <div
              key={lesson.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${lesson.status === "completed" ? "bg-emerald-500" : lesson.status === "missed" ? "bg-orange-400" : "bg-red-400"}`} />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {format(new Date(lesson.date), "d MMMM yyyy", { locale: ru })} · {lesson.start_time}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{resolveLessonTeacherLabel(lesson, teachers)}</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={STATUS_COLORS[lesson.status] || "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400"}
              >
                {STATUS_LABELS[lesson.status] || 'Статус неизвестен'}
              </Badge>
            </div>
          ))}
      </div>

      {/* TopUp Modal */}
      {showTopUp && <TopUpModal onClose={() => setShowTopUp(false)} />}
    </div>
  );
}