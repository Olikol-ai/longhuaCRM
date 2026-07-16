import React, { useState, useEffect } from "react";
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
import { getGreetingName } from "@/lib/display-name";
import { useTheme } from "@/lib/ThemeContext";
import { resolveAssignedTeacherLabel, resolveLessonTeacherLabel } from "@/lib/teacherLabels";

const STATUS_LABELS = {
  planned: "Запланировано",
  completed: "Завершено",
  cancelled: "Отменено",
  rescheduled: "Перенесено",
  missed: "Пропущено",
};

const STATUS_COLORS = {
  planned: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
  rescheduled: "bg-amber-50 text-amber-700",
  missed: "bg-orange-50 text-orange-700",
};

export default function StudentDashboard() {
  const { user, isLoadingAuth } = useAuth();
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

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadData();
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
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center py-20">
        <p className="text-slate-500">Профиль ученика не найден для вашего аккаунта.</p>
        <p className="text-xs text-slate-400 mt-2">Обратитесь к администратору.</p>
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
          <h1 className="text-2xl font-bold text-slate-900">
            Добро пожаловать, {getGreetingName(student) || getGreetingName(user) || "ученик"} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
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
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
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
        <StatCard title="Предстоящие уроки" value={upcoming.length} icon={Calendar} color="indigo" />
        <StatCard title="Завершённые уроки" value={completedCount} icon={Clock} color="sky" />
      </div>

      {/* Teacher card */}
      <Card className="p-4 mb-8 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
          <GraduationCap className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <p className="text-xs text-slate-400">Ваш преподаватель</p>
          <p className="text-lg font-semibold text-slate-900">
            {resolveAssignedTeacherLabel(student.assigned_teacher, teachers)}
          </p>
          {teacher?.specializations && (
            <p className="text-xs text-slate-500">{teacher.specializations}</p>
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
            <h2 className="text-lg font-semibold text-slate-900">Предстоящие уроки</h2>
            {upcomingExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
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
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "calendar" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
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
                <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Предстоящих уроков нет</p>
              </Card>
            ) : viewMode === "list" ? (
              <div className="space-y-3">
                {upcoming.map((lesson) => (
                  <Card key={lesson.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[64px] bg-indigo-50 rounded-xl py-2">
                          <p className="text-[11px] text-indigo-400 font-medium uppercase">
                            {format(new Date(lesson.date), "MMM", { locale: ru })}
                          </p>
                          <p className="text-2xl font-bold text-indigo-700 leading-tight">
                            {format(new Date(lesson.date), "d")}
                          </p>
                          <p className="text-[11px] text-indigo-400">
                            {format(new Date(lesson.date), "EEE", { locale: ru })}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{lesson.start_time}</p>
                          <p className="text-sm text-slate-600">{resolveLessonTeacherLabel(lesson, teachers)}</p>
                          <p className="text-xs text-slate-400">{lesson.duration || 60} мин</p>
                          {lesson.notes && <p className="text-xs text-slate-400 mt-1">{lesson.notes}</p>}
                        </div>
                      </div>
                      {lesson.meeting_link && (
                        <a
                          href={lesson.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors shrink-0"
                        >
                          <Video className="h-4 w-4" />
                          Войти
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
                      <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                        {format(new Date(dateStr), "d")}
                      </div>
                      <p className="text-sm font-semibold text-slate-700 capitalize">
                        {format(new Date(dateStr), "EEEE, d MMMM", { locale: ru })}
                      </p>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>
                    <div className="ml-11 space-y-2">
                      {dayLessons.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all">
                          <div className="w-14 text-center">
                            <p className="text-sm font-bold text-slate-900">{lesson.start_time}</p>
                            <p className="text-[10px] text-slate-400">{lesson.duration || 60} мин</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{resolveLessonTeacherLabel(lesson, teachers)}</p>
                            {lesson.notes && <p className="text-xs text-slate-400 truncate">{lesson.notes}</p>}
                          </div>
                          {lesson.meeting_link && (
                            <a
                              href={lesson.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline shrink-0"
                            >
                              <Video className="h-3 w-3" /> Войти
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
      <h2 className="text-lg font-semibold text-slate-900 mb-4">История уроков</h2>
      <div className="space-y-2">
        {lessons
          .filter((l) => l.status === "completed" || l.status === "cancelled" || l.status === "missed")
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
          .slice(0, 15)
          .map((lesson) => (
            <div
              key={lesson.id}
              className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200/70 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${lesson.status === "completed" ? "bg-emerald-500" : lesson.status === "missed" ? "bg-orange-400" : "bg-red-400"}`} />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {format(new Date(lesson.date), "d MMMM yyyy", { locale: ru })} · {lesson.start_time}
                  </p>
                  <p className="text-xs text-slate-400">{resolveLessonTeacherLabel(lesson, teachers)}</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={STATUS_COLORS[lesson.status] || "bg-slate-50 text-slate-600"}
              >
                {STATUS_LABELS[lesson.status] || lesson.status}
              </Badge>
            </div>
          ))}
      </div>

      {/* TopUp Modal */}
      {showTopUp && <TopUpModal onClose={() => setShowTopUp(false)} />}
    </div>
  );
}