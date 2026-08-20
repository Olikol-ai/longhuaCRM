import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Video,
  CheckCircle2,
  XCircle,
  Calendar,
  NotebookPen,
  Loader2,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
  isSameMonth,
} from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";
import { resolveLessonStudentLabel } from "@/lib/studentLabels";
import { resolveLessonTeacherLabel } from "@/lib/teacherLabels";
import { canStartVideoLesson, isOnlineLesson, lessonVideoPath } from "@/lib/lesson-video";
import { filterScheduleListLessons } from "@/lib/scheduleListLessons";
import LessonModal from "@/components/schedule/LessonModal";
import LessonDetailModal from "@/components/schedule/LessonDetailModal";
import RecurrenceApplyScopeDialog from "@/components/schedule/RecurrenceApplyScopeDialog";
import { lessonBelongsToSeries } from "@/lib/lessonSeriesScope";

export const WEEK_DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const STATUS_BG = {
  planned: "bg-brand",
  completed: "bg-emerald-500",
  cancelled: "bg-red-400",
  rescheduled: "bg-amber-500",
  missed: "bg-orange-400",
  missed_no_notice: "bg-red-700",
};

export const STATUS_BORDER = {
  planned: "border-l-brand",
  completed: "border-l-emerald-500",
  cancelled: "border-l-red-400",
  rescheduled: "border-l-amber-500",
  missed: "border-l-orange-400",
  missed_no_notice: "border-l-red-700",
};

export const STATUS_LABELS = {
  planned: "Запланировано",
  completed: "Проведено",
  cancelled: "Отменено",
  rescheduled: "Перенесено",
  missed: "Пропущено",
  missed_no_notice: "Без предупреждения",
};

/**
 * Shared school schedule board (teacher + admin).
 * Visual calendar is identical; role props control filters and actions.
 */
export default function SchoolScheduleCalendar({
  title = "Расписание",
  lessons,
  teachers,
  students,
  contacts = [],
  groups = [],
  loading = false,
  error = null,
  onRetry,
  /** 'admin' | 'teacher' */
  role = "teacher",
  /** When set, LessonModal / create default to this teacher */
  defaultTeacherId = "",
  showTeacherFilter = false,
  selectedTeacherId = "",
  onSelectedTeacherIdChange,
  onCreateLesson,
  onUpdateLesson,
  onDeleteLesson,
  onMarkLesson,
  onLessonsLocalPatch,
  showAttendance = false,
  /** Quick attendance / cancel on card expand (teacher UX) */
  showQuickActions = true,
  createButtonLabel = "Создать занятие",
  headerExtra = null,
}) {
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";
  const navigate = useNavigate();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week");
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewingLesson, setViewingLesson] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showCompletedInList, setShowCompletedInList] = useState(false);
  const [statusScopeOpen, setStatusScopeOpen] = useState(false);
  const [statusScopeValue, setStatusScopeValue] = useState("this");
  const [pendingMark, setPendingMark] = useState(null);

  const modalTeachers = useMemo(() => {
    if (defaultTeacherId) {
      const locked = teachers.filter((t) => t.id === defaultTeacherId);
      return locked.length ? locked : teachers;
    }
    return teachers;
  }, [teachers, defaultTeacherId]);

  const getLessonsForDay = (dateStr) =>
    lessons
      .filter((l) => l.date === dateStr)
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const selectedDayStr = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedDayLessons = selectedDayStr ? getLessonsForDay(selectedDayStr) : [];
  const listLessons = useMemo(
    () =>
      filterScheduleListLessons(lessons, {
        includeFinal: showCompletedInList,
      }),
    [lessons, showCompletedInList],
  );

  const openNewLesson = (dateStr) => {
    if (role === "teacher" && !defaultTeacherId) {
      toast({
        title: "Профиль преподавателя не найден",
        description: "Нельзя создать занятие без привязки к преподавателю",
        variant: "destructive",
      });
      return;
    }
    setSelectedDate(dateStr || format(new Date(), "yyyy-MM-dd"));
    setShowModal(true);
  };

  const openLessonDetails = (lesson) => {
    setViewingLesson(lesson);
    setExpandedLesson(null);
  };

  const runMarkLesson = async (lesson, status, completionAttendance = "attended", applyScope) => {
    setUpdating(lesson.id);
    try {
      await onMarkLesson(lesson, status, completionAttendance, applyScope);
      setExpandedLesson(null);
    } finally {
      setUpdating(null);
    }
  };

  const markLesson = async (lesson, status, completionAttendance = "attended") => {
    if (!onMarkLesson) return;
    if (status === "completed") {
      const isAbsent = completionAttendance === "missed";
      const confirmed = window.confirm(
        isAbsent
          ? "Подтвердить, что ученик отсутствовал?\n\nПосле подтверждения изменить отметку будет нельзя."
          : "Подтвердить посещение занятия?\n\nПосле подтверждения изменить отметку будет нельзя.",
      );
      if (!confirmed) return;
    }
    if (status === "cancelled" && lessonBelongsToSeries(lesson)) {
      setPendingMark({ lesson, status, completionAttendance });
      setStatusScopeValue("this");
      setStatusScopeOpen(true);
      return;
    }
    await runMarkLesson(lesson, status, completionAttendance, "this");
  };

  const handleSave = async (data, recurring) => {
    await onCreateLesson?.(data, recurring);
    setShowModal(false);
  };

  const handleUpdate = async (id, data) => {
    await onUpdateLesson?.(id, data);
    setViewingLesson(null);
    setExpandedLesson(null);
  };

  const handleDelete = async (id, applyScope = "this") => {
    if (!onDeleteLesson) return;
    await onDeleteLesson(id, applyScope);
    setViewingLesson(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center py-20 space-y-3">
        <p className="text-muted-foreground">{error}</p>
        {onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            Повторить
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto ">
      {headerExtra}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {showTeacherFilter ? (
            <select
              value={selectedTeacherId}
              onChange={(e) => onSelectedTeacherIdChange?.(e.target.value)}
              className="text-sm border border-border rounded-xl px-3 py-2 bg-card text-foreground w-full sm:w-auto sm:min-w-[200px] min-h-touch"
            >
              <option value="">Все преподаватели</option>
              {teachers
                .filter((t) => t.status !== "inactive")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          ) : null}

          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {[
              { id: "month", label: "Месяц" },
              { id: "week", label: "Неделя" },
              { id: "list", label: "Список" },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setViewMode(v.id);
                  setSelectedDay(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === v.id
                    ? "bg-card text-brand dark:text-brand shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <Button
            onClick={() => openNewLesson(null)}
            className="bg-primary hover:bg-primary/90 gap-2"
          >
            <Plus className="h-4 w-4" /> {createButtonLabel}
          </Button>
        </div>
      </div>

      {/* ==================== MONTHLY ==================== */}
      {viewMode === "month" && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="h-9 w-9"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-base font-semibold text-foreground flex-1 sm:flex-none sm:min-w-[180px] text-center capitalize truncate">
              {format(currentDate, "LLLL yyyy", { locale: ru })}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="h-9 w-9"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="ml-2 text-xs"
            >
              Сегодня
            </Button>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            {/* Mobile month: vertical day list */}
            <div className="md:hidden divide-y divide-border">
              {monthDays
                .filter((day) => isSameMonth(day, currentDate))
                .map((day) => {
                  const dayStr = format(day, "yyyy-MM-dd");
                  const dayLessons = getLessonsForDay(dayStr);
                  return (
                    <button
                      key={dayStr}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className="w-full text-left px-4 py-3 min-h-touch hover:bg-muted"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-semibold ${isToday(day) ? "text-brand" : ""}`}
                        >
                          {format(day, "EEEEEE d", { locale: ru })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dayLessons.length} ур.
                        </span>
                      </div>
                      {dayLessons.slice(0, 3).map((lesson) => (
                        <p
                          key={lesson.id}
                          className="text-xs text-muted-foreground mt-1 truncate"
                        >
                          {lesson.start_time}{" "}
                          {(
                            resolveLessonStudentLabel(lesson, students).split(" ")[0] ||
                            ""
                          )}
                          {isAdmin
                            ? ` · ${resolveLessonTeacherLabel(lesson, teachers).split(" ")[0] || ""}`
                            : ""}
                        </p>
                      ))}
                    </button>
                  );
                })}
            </div>

            {/* Desktop month grid */}
            <div className="hidden md:block overflow-x-auto">
              <div className="grid grid-cols-7 border-b border-border min-w-[520px]">
                {WEEK_DAYS_RU.map((d) => (
                  <div
                    key={d}
                    className="py-3 text-center text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wide"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 min-w-[520px]">
                {monthDays.map((day, i) => {
                  const dayStr = format(day, "yyyy-MM-dd");
                  const dayLessons = getLessonsForDay(dayStr);
                  const isSelected = selectedDayStr === dayStr;
                  const inMonth = isSameMonth(day, currentDate);
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={`min-h-[80px] p-2 border-b border-r border-border cursor-pointer transition-colors
                        ${isSelected ? "bg-brand-soft dark:bg-brand-soft/40" : "hover:bg-muted"}
                        ${!inMonth ? "opacity-40" : ""}
                      `}
                    >
                      <div
                        className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"}
                      `}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {dayLessons.slice(0, 2).map((lesson) => (
                          <div
                            key={lesson.id}
                            role="button"
                            tabIndex={0}
                            title="Открыть урок"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLessonDetails(lesson);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                openLessonDetails(lesson);
                              }
                            }}
                            className={`text-[10px] font-medium text-white px-1.5 py-0.5 rounded-md truncate hover:opacity-90 cursor-pointer ${STATUS_BG[lesson.status] || "bg-muted-foreground"}`}
                          >
                            {lesson.start_time}{" "}
                            {(
                              resolveLessonStudentLabel(lesson, students).split(" ")[0] ||
                              ""
                            )}
                          </div>
                        ))}
                        {dayLessons.length > 2 && (
                          <p className="text-[9px] text-muted-foreground pl-1">
                            +{dayLessons.length - 2} ещё
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedDay && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground capitalize">
                  {format(selectedDay, "EEEE, d MMMM", { locale: ru })}
                </h3>
                <Button
                  size="sm"
                  onClick={() => openNewLesson(selectedDayStr)}
                  className="bg-primary hover:bg-primary/90 h-7 text-xs gap-1"
                >
                  <Plus className="h-3 w-3" /> Добавить
                </Button>
              </div>
              {selectedDayLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground dark:text-muted-foreground text-center py-6 bg-card rounded-xl border border-dashed border-border">
                  Уроков нет
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayLessons.map((lesson) => (
                    <ScheduleLessonCard
                      key={lesson.id}
                      lesson={lesson}
                      students={students}
                      teachers={teachers}
                      showTeacher={isAdmin}
                      expandedLesson={expandedLesson}
                      setExpandedLesson={setExpandedLesson}
                      markLesson={showQuickActions ? markLesson : null}
                      updating={updating}
                      onOpenDetails={openLessonDetails}
                      showQuickActions={showQuickActions}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== WEEKLY ==================== */}
      {viewMode === "week" && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
              className="h-9 w-9"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-base font-semibold text-foreground flex-1 sm:flex-none sm:min-w-[220px] text-center truncate">
              {format(weekDays[0], "d MMM", { locale: ru })} —{" "}
              {format(weekDays[6], "d MMM yyyy", { locale: ru })}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
              className="h-9 w-9"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="ml-2 text-xs"
            >
              Сегодня
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekDays.map((day, i) => {
              const dayStr = format(day, "yyyy-MM-dd");
              const dayLessons = getLessonsForDay(dayStr);
              return (
                <div
                  key={i}
                  className={`rounded-2xl border p-3 ${
                    isToday(day)
                      ? "border-brand/40 bg-brand-soft/40 dark:bg-brand-soft/40 dark:border-brand/40"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase font-medium">
                        {WEEK_DAYS_RU[i]}
                      </p>
                      <div
                        className={`text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full mt-0.5 ${
                          isToday(day)
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openNewLesson(dayStr)}
                      className="h-7 w-7 rounded-lg bg-brand-soft dark:bg-brand-soft/40 hover:bg-brand-muted flex items-center justify-center transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 text-brand" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dayLessons.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-3">—</div>
                    ) : (
                      dayLessons.map((lesson) => (
                        <WeekLessonChip
                          key={lesson.id}
                          lesson={lesson}
                          students={students}
                          teachers={teachers}
                          showTeacher={isAdmin}
                          expandedLesson={expandedLesson}
                          setExpandedLesson={setExpandedLesson}
                          markLesson={showQuickActions ? markLesson : null}
                          updating={updating}
                          onOpenDetails={openLessonDetails}
                          showQuickActions={showQuickActions}
                          isAdmin={isAdmin}
                          navigate={navigate}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== LIST ==================== */}
      {viewMode === "list" && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Показаны актуальные занятия. Завершённые скрыты по умолчанию.
            </p>
            <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand rounded border-border"
                checked={showCompletedInList}
                onChange={(e) => setShowCompletedInList(e.target.checked)}
                data-testid="schedule-list-show-completed"
              />
              Показать завершённые занятия
            </label>
          </div>
          {listLessons.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {showCompletedInList
                ? "Уроков нет"
                : "Нет актуальных занятий"}
            </div>
          ) : (
            listLessons.map((lesson) => (
              <ScheduleLessonCard
                key={lesson.id}
                lesson={lesson}
                students={students}
                teachers={teachers}
                showTeacher={isAdmin}
                expandedLesson={expandedLesson}
                setExpandedLesson={setExpandedLesson}
                markLesson={showQuickActions ? markLesson : null}
                updating={updating}
                onOpenDetails={openLessonDetails}
                showQuickActions={showQuickActions}
                isAdmin={isAdmin}
              />
            ))
          )}
        </div>
      )}

      {showModal && (role !== "teacher" || defaultTeacherId) ? (
        <LessonModal
          date={selectedDate}
          teachers={modalTeachers}
          students={students}
          contacts={contacts}
          groups={groups}
          defaultTeacherId={defaultTeacherId || selectedTeacherId || ""}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      ) : null}

      {viewingLesson && (
        <LessonDetailModal
          lesson={viewingLesson}
          teachers={teachers}
          students={students}
          contacts={contacts}
          isAdmin={isAdmin}
          isTeacher={isTeacher}
          onUpdate={handleUpdate}
          onDelete={onDeleteLesson ? handleDelete : () => {}}
          onStudentsUpdated={(updated) => {
            setViewingLesson(updated);
            onLessonsLocalPatch?.(updated);
          }}
          onClose={() => setViewingLesson(null)}
          showAttendance={showAttendance}
        />
      )}

      <RecurrenceApplyScopeDialog
        open={statusScopeOpen}
        mode="status"
        value={statusScopeValue}
        onChange={setStatusScopeValue}
        title="Отменить:"
        confirmLabel="Отменить"
        onCancel={() => {
          setStatusScopeOpen(false);
          setPendingMark(null);
        }}
        onConfirm={() => {
          if (!pendingMark) return;
          const { lesson, status, completionAttendance } = pendingMark;
          setStatusScopeOpen(false);
          setPendingMark(null);
          void runMarkLesson(lesson, status, completionAttendance, statusScopeValue);
        }}
      />
    </div>
  );
}

function WeekLessonChip({
  lesson,
  students,
  teachers,
  showTeacher,
  expandedLesson,
  setExpandedLesson,
  markLesson,
  updating,
  onOpenDetails,
  showQuickActions,
  isAdmin,
  navigate,
}) {
  const studentLabel = resolveLessonStudentLabel(lesson, students);
  const teacherLabel = resolveLessonTeacherLabel(lesson, teachers);

  const openDetails = (e) => {
    e?.stopPropagation?.();
    onOpenDetails?.(lesson);
  };

  return (
    <div
      className={`p-2.5 bg-card rounded-xl border-l-4 border border-border shadow-sm cursor-pointer hover:shadow-md transition-all ${STATUS_BORDER[lesson.status] || "border-l-muted-foreground"}`}
      title="Двойной клик — открыть урок"
      onClick={() => {
        // Admin: open lesson card immediately (edit lives inside the modal).
        // Teacher: first click expands quick actions; details via «Перенести» / double-click.
        if (isAdmin || !showQuickActions) {
          onOpenDetails(lesson);
          return;
        }
        setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id);
      }}
      onDoubleClick={openDetails}
    >
      <p className="text-xs font-bold text-foreground">{lesson.start_time}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
        {studentLabel}
      </p>
      {showTeacher ? (
        <p className="text-[10px] text-muted-foreground truncate">{teacherLabel}</p>
      ) : null}
      <p className="text-[10px] text-muted-foreground">{lesson.duration || 60} мин</p>
      {isOnlineLesson(lesson) && (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[10px] text-brand hover:underline mt-1"
          onClick={(e) => {
            e.stopPropagation();
            const gate = canStartVideoLesson(lesson);
            if (!gate.ok && gate.reason === "too_early") {
              toast({
                title: "Видеоурок ещё не начался",
                description: "Войти можно за 10 минут до начала.",
              });
              return;
            }
            navigate(lessonVideoPath(lesson.id));
          }}
        >
          <Video className="h-2.5 w-2.5" />{" "}
          {isAdmin ? "Видеоурок" : "Начать видеоурок"}
        </button>
      )}
      {showQuickActions && !isAdmin && expandedLesson === lesson.id ? (
        <>
          <QuickActionsPanel
            lesson={lesson}
            compact
            updating={updating}
            markLesson={lesson.status === "planned" ? markLesson : null}
            onOpenDetails={onOpenDetails}
            isAdmin={isAdmin}
          />
          {lesson.status === "completed" ? (
            <HomeworkAction lesson={lesson} compact navigate={navigate} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function ScheduleLessonCard({
  lesson,
  students,
  teachers = [],
  showTeacher = false,
  expandedLesson,
  setExpandedLesson,
  markLesson,
  updating,
  onOpenDetails,
  showQuickActions = true,
  isAdmin = false,
}) {
  const navigate = useNavigate();
  return (
    <div
      className={`p-4 bg-card rounded-xl border-l-4 border border-border cursor-pointer hover:shadow-sm transition-all ${STATUS_BORDER[lesson.status] || "border-l-muted-foreground"}`}
      title="Двойной клик — открыть урок"
      onClick={() => {
        if (isAdmin || !showQuickActions) {
          onOpenDetails?.(lesson);
          return;
        }
        setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpenDetails?.(lesson);
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="text-center min-w-[56px] bg-muted rounded-xl py-2">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">
              {format(new Date(lesson.date), "MMM", { locale: ru })}
            </p>
            <p className="text-xl font-bold text-foreground leading-tight">
              {format(new Date(lesson.date), "d")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(lesson.date), "EEE", { locale: ru })}
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {lesson.start_time}
            </p>
            <p className="text-sm text-muted-foreground">
              {resolveLessonStudentLabel(lesson, students)}
            </p>
            {showTeacher ? (
              <p className="text-xs text-muted-foreground">
                {resolveLessonTeacherLabel(lesson, teachers)}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">{lesson.duration || 60} мин</p>
            {isOnlineLesson(lesson) && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-brand hover:underline mt-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  const gate = canStartVideoLesson(lesson);
                  if (!gate.ok && gate.reason === "too_early") {
                    toast({
                      title: "Видеоурок ещё не начался",
                      description: "Войти можно за 10 минут до начала.",
                    });
                    return;
                  }
                  navigate(lessonVideoPath(lesson.id));
                }}
              >
                <Video className="h-3 w-3" />{" "}
                {isAdmin ? "Видеоурок" : "Начать видеоурок"}
              </button>
            )}
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-[11px] shrink-0 ${
            lesson.status === "planned"
              ? "bg-brand-soft text-brand dark:bg-brand-soft/40 dark:text-brand dark:border-brand/40"
              : lesson.status === "completed"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {STATUS_LABELS[lesson.status] || lesson.status}
        </Badge>
      </div>

      {showQuickActions && !isAdmin && expandedLesson === lesson.id ? (
        <>
          <QuickActionsPanel
            lesson={lesson}
            compact={false}
            updating={updating}
            markLesson={lesson.status === "planned" ? markLesson : null}
            onOpenDetails={onOpenDetails}
            isAdmin={isAdmin}
          />
          {lesson.status === "completed" ? (
            <HomeworkAction lesson={lesson} compact={false} navigate={navigate} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function QuickActionsPanel({
  lesson,
  compact,
  updating,
  markLesson,
  onOpenDetails,
  isAdmin,
}) {
  const isGroup = Boolean(
    lesson.group_id ||
      lesson.groupId ||
      lesson.lesson_type === "group" ||
      lesson.lessonType === "group",
  );

  const actions = isAdmin
    ? [
        {
          status: "completed",
          attendance: "attended",
          icon: CheckCircle2,
          label: "Проведено",
          cls: compact
            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 dark:border-emerald-800",
        },
        {
          status: "cancelled",
          attendance: null,
          icon: XCircle,
          label: "Отменить",
          cls: compact
            ? "bg-red-50 text-red-600 hover:bg-red-100"
            : "bg-red-50 text-red-600 hover:bg-red-100 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 dark:border-red-800",
        },
      ]
    : isGroup
      ? [
          {
            status: "completed",
            attendance: "attended",
            icon: CheckCircle2,
            label: "Ученик присутствовал",
            cls: compact
              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 dark:border-emerald-800",
          },
          {
            status: "completed",
            attendance: "missed",
            icon: XCircle,
            label: "Ученик отсутствовал",
            cls: compact
              ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
              : "bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-950/60 dark:border-orange-800",
          },
          {
            status: "cancelled",
            attendance: null,
            icon: XCircle,
            label: "Отменить",
            cls: compact
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "bg-red-50 text-red-600 hover:bg-red-100 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 dark:border-red-800",
          },
        ]
      : [
          {
            status: "completed",
            attendance: "attended",
            icon: CheckCircle2,
            label: "Ученик присутствовал",
            cls: compact
              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 dark:border-emerald-800",
          },
          {
            status: "cancelled",
            attendance: null,
            icon: XCircle,
            label: "Отменить",
            cls: compact
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "bg-red-50 text-red-600 hover:bg-red-100 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 dark:border-red-800",
          },
        ];

  const wrap = compact
    ? "mt-2 pt-2 border-t border-border space-y-1"
    : "mt-3 pt-3 border-t border-border flex flex-wrap gap-2";
  const btnBase = compact
    ? "w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium rounded-lg transition-colors"
    : "flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg border transition-colors";

  return (
    <div className={wrap} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetails?.(lesson);
        }}
        className={`${btnBase} ${
          compact
            ? "bg-brand-soft text-brand hover:bg-brand-muted"
            : "bg-brand-soft text-brand border-brand/30 hover:bg-brand-muted dark:bg-brand-soft/40 dark:text-brand dark:border-brand/40"
        }`}
      >
        <Calendar className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />{" "}
        {isAdmin ? "Изменить" : "Открыть / перенести"}
      </button>
      {markLesson
        ? actions.map(({ status, attendance, icon: Icon, label, cls }) => (
            <button
              key={`${status}-${attendance || "none"}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                markLesson(lesson, status, attendance || "attended");
              }}
              disabled={updating === lesson.id}
              className={`${btnBase} disabled:opacity-50 ${cls}`}
            >
              <Icon className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} /> {label}
            </button>
          ))
        : null}
    </div>
  );
}

function HomeworkAction({ lesson, compact, navigate }) {
  const wrap = compact
    ? "mt-2 pt-2 border-t border-border"
    : "mt-3 pt-3 border-t border-border";
  const btn = compact
    ? "w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium rounded-lg bg-brand-soft text-brand hover:bg-brand-muted"
    : "flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg border bg-brand-soft text-brand hover:bg-brand-muted border-brand/20";

  return (
    <div className={wrap}>
      <button
        type="button"
        data-testid={
          compact
            ? "assign-homework-from-lesson"
            : "assign-homework-from-lesson-card"
        }
        onClick={(e) => {
          e.stopPropagation();
          const sid =
            lesson.primary_student_id ||
            lesson.student_id ||
            lesson.primaryStudentId;
          const q = new URLSearchParams({ lessonId: lesson.id });
          if (sid) q.set("studentId", sid);
          navigate(`${createPageUrl("HomeworkAssignment")}?${q.toString()}`);
        }}
        className={btn}
      >
        <NotebookPen className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} /> Назначить
        домашнее задание
      </button>
    </div>
  );
}
