import React, { useState, useEffect, useRef } from "react";
import { api } from '@/api';
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar, BookOpen, GraduationCap, Video, Clock, Loader2, Plus, ChevronDown, ChevronUp, List } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, EmptyState } from "@/design-system";
import StatCard from "@/components/dashboard/StatCard";
import TopUpModal from "@/components/student/TopUpModal";
import { useAuth } from "@/lib/AuthContext";
import { formatWelcomeGreeting, getGreetingName } from "@/lib/display-name";
import { resolveAssignedTeacherLabel, resolveLessonTeacherLabel } from "@/lib/teacherLabels";
import { isOnlineLesson, lessonVideoPath } from "@/lib/lesson-video";
import { getLessonBalance, lessonBalanceStatColor } from "@/lib/lessonBalance";
import LessonBalanceDisplay from "@/components/students/LessonBalanceDisplay";
import { OfflineSnapshotBanner } from "@/components/pwa/OfflineSnapshotBanner";
import { OFFLINE_RESOURCES, putSnapshot, readWithOfflineFallback } from "@/lib/offline";
import { offlineStaleCaption } from "@/lib/offline/formatUpdatedAt";

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
  const [offlineMeta, setOfflineMeta] = useState({ fromCache: false, updatedAt: null, missing: false });
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
    try {
      const result = await readWithOfflineFallback({
        userId: user.id,
        role: user.role || 'student',
        resource: OFFLINE_RESOURCES.SCHEDULE,
        resourceKey: 'student_dashboard',
        fetcher: async () => {
          const [myStudents, allLessons, allTeachers] = await Promise.all([
            api.students.filter({ user_id: user.id }),
            api.lessons.list("-date", 200),
            api.teachers.list(),
          ]);
          const s = myStudents[0] || null;
          const filtered = s
            ? allLessons.filter((l) =>
                l.primary_student_id === s.id ||
                l.student_id === s.id ||
                (l.student_ids || []).includes(s.id)
              )
            : [];
          return {
            student: s,
            lessons: filtered,
            teachers: allTeachers,
            teacher: s?.assigned_teacher
              ? allTeachers.find((t) => t.id === s.assigned_teacher) || null
              : null,
          };
        },
      });
      setOfflineMeta({
        fromCache: result.fromCache,
        updatedAt: result.updatedAt,
        missing: result.missing,
      });
      const payload = result.data || {};
      setStudent(payload.student || null);
      setLessons(payload.lessons || []);
      setTeachers(payload.teachers || []);
      setTeacher(payload.teacher || null);
      if (payload.student) {
        await putSnapshot({
          userId: user.id,
          role: user.role || 'student',
          resource: OFFLINE_RESOURCES.BALANCE,
          resourceKey: 'lesson_balance',
          data: {
            lesson_balance: getLessonBalance(payload.student),
            student_id: payload.student.id,
          },
        });
      }
    } catch {
      setStudent(null);
      setLessons([]);
      setOfflineMeta({ fromCache: false, updatedAt: null, missing: true });
    } finally {
      setLoading(false);
    }
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
        <p className="text-muted-foreground">Профиль ученика не найден для вашего аккаунта.</p>
        <p className="text-xs text-muted-foreground mt-2">Обратитесь к администратору.</p>
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
      <OfflineSnapshotBanner
        fromCache={offlineMeta.fromCache}
        updatedAt={offlineMeta.updatedAt}
        missing={offlineMeta.missing}
        emptyLabel="Данные пока недоступны без подключения"
        className="mb-4"
      />
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {formatWelcomeGreeting(
              getGreetingName(student) ? student : getGreetingName(user) ? user : null,
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: ru })}
          </p>
          {offlineMeta.fromCache && offlineMeta.updatedAt ? (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Баланс: {offlineStaleCaption(offlineMeta.updatedAt)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button intent="primary" onClick={() => setShowTopUp(true)}>
            <Plus className="h-4 w-4" />
            Пополнить баланс
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {(() => {
          const balance = getLessonBalance(student);
          return (
            <StatCard
              title="Баланс уроков"
              value={<LessonBalanceDisplay balance={balance} />}
              icon={BookOpen}
              color={lessonBalanceStatColor(balance)}
              subtitle={balance < 0 ? "Задолженность перед школой" : undefined}
            />
          );
        })()}
        <StatCard title="Предстоящие уроки" value={upcoming.length} icon={Calendar} color="brand" />
        <StatCard title="Завершённые уроки" value={completedCount} icon={Clock} color="muted" />
      </div>

      {/* Teacher card */}
      <Card className="p-4 mb-8 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
          <GraduationCap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ваш преподаватель</p>
          <p className="text-lg font-semibold text-foreground">
            {resolveAssignedTeacherLabel(student.assigned_teacher, teachers)}
          </p>
          {teacher?.specializations && (
            <p className="text-xs text-muted-foreground">{teacher.specializations}</p>
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
            <h2 className="text-lg font-semibold text-foreground">Предстоящие уроки</h2>
            {upcomingExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
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
              <div className="flex gap-1 bg-muted rounded-lg p-1" role="group" aria-label="Вид списка">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                  aria-label="Список"
                  className={`min-h-touch min-w-touch inline-flex items-center justify-center rounded-md transition-colors ${viewMode === "list" ? "bg-card shadow-sm text-brand" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("calendar")}
                  aria-pressed={viewMode === "calendar"}
                  aria-label="Календарь"
                  className={`min-h-touch min-w-touch inline-flex items-center justify-center rounded-md transition-colors ${viewMode === "calendar" ? "bg-card shadow-sm text-brand" : "text-muted-foreground hover:text-foreground"}`}
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
              <Card className="border-dashed">
                <EmptyState preset="lessons" title="Предстоящих уроков нет" icon={Calendar} />
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
                          <p className="font-semibold text-foreground">{lesson.start_time}</p>
                          <p className="text-sm text-muted-foreground">{resolveLessonTeacherLabel(lesson, teachers)}</p>
                          <p className="text-xs text-muted-foreground">{lesson.duration || 60} мин</p>
                          {lesson.notes && <p className="text-xs text-muted-foreground mt-1">{lesson.notes}</p>}
                        </div>
                      </div>
                      {isOnlineLesson(lesson) && (
                        <a
                          href={lessonVideoPath(lesson.id)}
                          className="inline-flex min-h-touch items-center gap-2 px-4 py-2 bg-brand-soft dark:bg-brand-soft/40 text-brand rounded-xl text-sm font-medium hover:bg-brand-muted dark:hover:bg-brand-soft/60 transition-colors shrink-0"
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
                      <p className="text-sm font-semibold text-foreground capitalize">
                        {format(new Date(dateStr), "EEEE, d MMMM", { locale: ru })}
                      </p>
                      <div className="flex-1 h-px bg-muted" />
                    </div>
                    <div className="ml-11 space-y-2">
                      {dayLessons.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:border-brand/30 hover:shadow-sm transition-all">
                          <div className="w-14 text-center">
                            <p className="text-sm font-bold text-foreground">{lesson.start_time}</p>
                            <p className="text-[10px] text-muted-foreground">{lesson.duration || 60} мин</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{resolveLessonTeacherLabel(lesson, teachers)}</p>
                            {lesson.notes && <p className="text-xs text-muted-foreground truncate">{lesson.notes}</p>}
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
      <h2 className="text-lg font-semibold text-foreground mb-4">История уроков</h2>
      <div className="space-y-2">
        {lessons
          .filter((l) => l.status === "completed" || l.status === "cancelled" || l.status === "missed")
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
          .slice(0, 15)
          .map((lesson) => (
            <div
              key={lesson.id}
              className="flex items-center justify-between p-3 bg-card rounded-xl border border-border hover:border-border transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${lesson.status === "completed" ? "bg-emerald-500" : lesson.status === "missed" ? "bg-orange-400" : "bg-red-400"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(lesson.date), "d MMMM yyyy", { locale: ru })} · {lesson.start_time}
                  </p>
                  <p className="text-xs text-muted-foreground">{resolveLessonTeacherLabel(lesson, teachers)}</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={STATUS_COLORS[lesson.status] || "bg-muted text-muted-foreground"}
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