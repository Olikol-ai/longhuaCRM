import React, { useState, useEffect, useMemo } from "react";
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { Button } from "@/components/ui/button";
import TeacherAvailabilityTab from "@/components/schedule/TeacherAvailabilityTab";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Loader2, Video, Plus,
  CheckCircle2, XCircle, Calendar, List, Sun, Moon,
} from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { resolveLessonStudentLabel } from "@/lib/studentLabels";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks,
  isToday, isSameMonth, parseISO, addDays,
} from "date-fns";
import { ru } from "date-fns/locale";
import LessonModal from "@/components/schedule/LessonModal";
import LessonDetailModal from "@/components/schedule/LessonDetailModal";
import { createWeeklyLessonSeries } from "@/lib/recurring-lessons";
import { toast } from "@/components/ui/use-toast";

const STATUS_BG = {
  planned: "bg-brand",
  completed: "bg-emerald-500",
  cancelled: "bg-red-400",
  rescheduled: "bg-amber-500",
  missed: "bg-orange-400",
  missed_no_notice: "bg-red-700",
};
const STATUS_BORDER = {
  planned: "border-l-brand",
  completed: "border-l-emerald-500",
  cancelled: "border-l-red-400",
  rescheduled: "border-l-amber-500",
  missed: "border-l-orange-400",
  missed_no_notice: "border-l-red-700",
};
const STATUS_LABELS = {
  planned: "Запланировано",
  completed: "Проведено",
  cancelled: "Отменено",
  missed: "Пропущено",
  missed_no_notice: "Без предупреждения",
};

const WEEK_DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function TeacherSchedule() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [allTeachers, setAllTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week"); // "month" | "week" | "list"
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewingLesson, setViewingLesson] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [mainTab, setMainTab] = useState("schedule"); // "schedule" | "availability"
  const [loadError, setLoadError] = useState(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoadError(null);
    try {
      const [teachers, allLessons, allStudents, allGroups] = await Promise.all([
        api.teachers.list(),
        api.lessons.list("-date", 500),
        api.students.list(),
        api.groups.list(),
      ]);
      const t = teachers.find((row) => row.user_id === user.id || row.email === user.email);
      setAllTeachers(teachers);
      if (t) {
        setTeacher(t);
        setLessons(allLessons.filter((l) => l.teacher_id === t.id));
        setStudents(allStudents.filter((s) => s.assigned_teacher === t.id));
        setGroups(allGroups.filter((g) => g.teacher_id === t.id));
      } else {
        setTeacher(null);
        setLessons([]);
        setStudents([]);
        setGroups([]);
      }
    } catch (err) {
      setLoadError(err?.message || "Не удалось загрузить расписание");
    } finally {
      setLoading(false);
    }
  };

  const getLessonsForDay = (dateStr) =>
    lessons.filter(l => l.date === dateStr).sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  // Monthly grid
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Weekly grid
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const markLesson = async (lesson, status, completionAttendance = "attended") => {
    if (status === "completed") {
      const isAbsent = completionAttendance === "missed";
      const confirmed = window.confirm(
        isAbsent
          ? "Подтвердить, что ученик отсутствовал?\n\nПосле подтверждения изменить отметку будет нельзя."
          : "Подтвердить посещение занятия?\n\nПосле подтверждения изменить отметку будет нельзя.",
      );
      if (!confirmed) return;
    }

    setUpdating(lesson.id);
    try {
      const payload =
        status === "completed"
          ? { status, completion_attendance: completionAttendance }
          : { status };
      await api.lessons.update(lesson.id, payload);
      setExpandedLesson(null);
      toast({
        title:
          status === "completed"
            ? completionAttendance === "missed"
              ? "Отсутствие зафиксировано."
              : "Посещение подтверждено."
            : "Статус занятия обновлён.",
      });
      await loadData();
    } catch (err) {
      toast({
        title: "Не удалось обновить урок",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleSaveLesson = async (data, recurring) => {
    if (!teacher) return;
    try {
      const lessonData = { ...data, teacher_id: teacher.id };
      await createWeeklyLessonSeries(
        (payload) => api.lessons.create(payload),
        lessonData,
        recurring,
      );
      setShowModal(false);
      await loadData();
    } catch (err) {
      toast({
        title: "Не удалось создать урок",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
    }
  };

  const handleUpdateLesson = async (id, data) => {
    const previous = viewingLesson;
    const timeChanged =
      (data.date != null && data.date !== previous?.date) ||
      (data.start_time != null &&
        String(data.start_time).slice(0, 5) !== String(previous?.start_time || "").slice(0, 5)) ||
      (data.duration != null && Number(data.duration) !== Number(previous?.duration || 60));
    const attendanceConfirmed = data.status === "completed";
    const wasAbsent = data.completion_attendance === "missed";

    try {
      await api.lessons.update(id, data);
      setViewingLesson(null);
      setExpandedLesson(null);
      toast({
        title: attendanceConfirmed
          ? wasAbsent
            ? "Отсутствие зафиксировано."
            : "Посещение подтверждено."
          : timeChanged
            ? "Занятие успешно перенесено."
            : "Информация о занятии обновлена.",
      });
      await loadData();
    } catch (err) {
      toast({
        title: attendanceConfirmed
          ? "Не удалось завершить занятие"
          : timeChanged
            ? "Не удалось перенести занятие"
            : "Не удалось обновить занятие",
        description: err?.message || "Проверьте свободный график и пересечения",
        variant: "destructive",
      });
      throw err;
    }
  };

  const openNewLesson = (dateStr) => {
    setSelectedDate(dateStr || format(new Date(), "yyyy-MM-dd"));
    setShowModal(true);
  };

  const openLessonDetails = (lesson) => {
    setViewingLesson(lesson);
    setExpandedLesson(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>;
  }

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center py-20 space-y-3">
        <p className="text-slate-600 dark:text-slate-300">{loadError}</p>
        <Button variant="outline" onClick={() => { setLoading(true); loadData(); }}>
          Повторить
        </Button>
      </div>
    );
  }

  const selectedDayStr = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedDayLessons = selectedDayStr ? getLessonsForDay(selectedDayStr) : [];

  // List: all lessons sorted
  const listLessons = [...lessons].sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto dark:bg-slate-950 min-h-screen">
      {/* Main tabs */}
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setMainTab("schedule")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              mainTab === "schedule" ? "bg-white dark:bg-slate-700 text-brand dark:text-brand shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Моё расписание
          </button>
          <button
            onClick={() => setMainTab("availability")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              mainTab === "availability" ? "bg-white dark:bg-slate-700 text-brand dark:text-brand shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Свободный график
          </button>
        </div>
        <button onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Сменить тему">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {mainTab === "availability" && (
        <TeacherAvailabilityTab teacher={teacher} />
      )}

      {mainTab === "schedule" && (
      <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Моё расписание</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View switcher */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            {[
              { id: "month", label: "Месяц" },
              { id: "week", label: "Неделя" },
              { id: "list", label: "Список" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => { setViewMode(v.id); setSelectedDay(null); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === v.id ? "bg-white dark:bg-slate-700 text-brand dark:text-brand shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Button onClick={() => openNewLesson(null)} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="h-4 w-4" /> Создать занятие
          </Button>
        </div>
      </div>

      {/* ==================== MONTHLY ==================== */}
      {viewMode === "month" && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex-1 sm:flex-none sm:min-w-[180px] text-center capitalize truncate">
              {format(currentDate, "LLLL yyyy", { locale: ru })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="ml-2 text-xs">
              Сегодня
            </Button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700 min-w-[520px]">
              {WEEK_DAYS_RU.map((d) => (
                <div key={d} className="py-3 text-center text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide">{d}</div>
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
                    className={`min-h-[80px] p-2 border-b border-r border-slate-100 dark:border-slate-700 cursor-pointer transition-colors
                      ${isSelected ? "bg-brand-soft dark:bg-brand-soft/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"}
                      ${!inMonth ? "opacity-40" : ""}
                    `}
                  >
                    <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday(day) ? "bg-primary text-primary-foreground" : "text-slate-700 dark:text-slate-300"}
                    `}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayLessons.slice(0, 2).map((lesson) => (
                        <div key={lesson.id} className={`text-[10px] font-medium text-white px-1.5 py-0.5 rounded-md truncate ${STATUS_BG[lesson.status] || "bg-slate-400"}`}>
                          {lesson.start_time} {(resolveLessonStudentLabel(lesson, students).split(" ")[0] || "")}
                        </div>
                      ))}
                      {dayLessons.length > 2 && <p className="text-[9px] text-slate-400 pl-1">+{dayLessons.length - 2} ещё</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day detail */}
          {selectedDay && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">
                  {format(selectedDay, "EEEE, d MMMM", { locale: ru })}
                </h3>
                <Button size="sm" onClick={() => openNewLesson(selectedDayStr)} className="bg-primary hover:bg-primary/90 h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Добавить
                </Button>
              </div>
              {selectedDayLessons.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-400 text-center py-6 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">Уроков нет</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayLessons.map((lesson) => (
                    <TeacherLessonCard
                      key={lesson.id}
                      lesson={lesson}
                      students={students}
                      expandedLesson={expandedLesson}
                      setExpandedLesson={setExpandedLesson}
                      markLesson={markLesson}
                      updating={updating}
                      onOpenDetails={openLessonDetails}
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
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex-1 sm:flex-none sm:min-w-[220px] text-center truncate">
              {format(weekDays[0], "d MMM", { locale: ru })} — {format(weekDays[6], "d MMM yyyy", { locale: ru })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="ml-2 text-xs">
              Сегодня
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekDays.map((day, i) => {
              const dayStr = format(day, "yyyy-MM-dd");
              const dayLessons = getLessonsForDay(dayStr);
              return (
                <div key={i} className={`rounded-2xl border p-3 ${isToday(day) ? "border-brand/40 bg-brand-soft/40 dark:bg-brand-soft/40 dark:border-brand/40" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase font-medium">{WEEK_DAYS_RU[i]}</p>
                      <div className={`text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full mt-0.5 ${isToday(day) ? "bg-primary text-primary-foreground" : "text-slate-900 dark:text-white"}`}>
                        {format(day, "d")}
                      </div>
                    </div>
                    <button
                      onClick={() => openNewLesson(dayStr)}
                      className="h-7 w-7 rounded-lg bg-brand-soft dark:bg-brand-soft/40 hover:bg-brand-muted flex items-center justify-center transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 text-brand" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dayLessons.length === 0 ? (
                      <div className="text-xs text-slate-300 text-center py-3">—</div>
                    ) : (
                      dayLessons.map(lesson => (
                        <div
                          key={lesson.id}
                          className={`p-2.5 bg-white dark:bg-slate-900 rounded-xl border-l-4 border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer hover:shadow-md transition-all ${STATUS_BORDER[lesson.status] || "border-l-slate-300"}`}
                          onClick={() => setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id)}
                        >
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{lesson.start_time}</p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                            {resolveLessonStudentLabel(lesson, students)}
                          </p>
                          <p className="text-[10px] text-slate-400">{lesson.duration || 60} мин</p>
                          {lesson.meeting_link && (
                            <a href={lesson.meeting_link} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-brand hover:underline mt-1"
                              onClick={e => e.stopPropagation()}>
                              <Video className="h-2.5 w-2.5" /> Войти
                            </a>
                          )}
                          {expandedLesson === lesson.id && lesson.status === "planned" && (
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openLessonDetails(lesson); }}
                                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium rounded-lg transition-colors bg-brand-soft text-brand hover:bg-brand-muted"
                              >
                                <Calendar className="w-3 h-3" /> Перенести
                              </button>
                              {(
                                (lesson.group_id || lesson.groupId || lesson.lesson_type === "group" || lesson.lessonType === "group")
                                  ? [
                                      { status: "completed", attendance: "attended", icon: CheckCircle2, label: "Ученик присутствовал", cls: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
                                      { status: "completed", attendance: "missed", icon: XCircle, label: "Ученик отсутствовал", cls: "bg-orange-50 text-orange-600 hover:bg-orange-100" },
                                      { status: "cancelled", attendance: null, icon: XCircle, label: "Отменить", cls: "bg-red-50 text-red-600 hover:bg-red-100" },
                                    ]
                                  : [
                                      { status: "completed", attendance: "attended", icon: CheckCircle2, label: "Ученик присутствовал", cls: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
                                      { status: "cancelled", attendance: null, icon: XCircle, label: "Отменить", cls: "bg-red-50 text-red-600 hover:bg-red-100" },
                                    ]
                              ).map(({ status, attendance, icon: Icon, label, cls }) => (
                                <button
                                  key={`${status}-${attendance || "none"}`}
                                  onClick={e => { e.stopPropagation(); markLesson(lesson, status, attendance || "attended"); }}
                                  disabled={updating === lesson.id}
                                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium rounded-lg transition-colors disabled:opacity-50 ${cls}`}
                                >
                                  <Icon className="w-3 h-3" /> {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
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
        <div className="space-y-2">
          {listLessons.length === 0 ? (
            <div className="text-center py-16 text-slate-400">Уроков нет</div>
          ) : (
            listLessons.map((lesson) => (
              <TeacherLessonCard
                key={lesson.id}
                lesson={lesson}
                students={students}
                expandedLesson={expandedLesson}
                setExpandedLesson={setExpandedLesson}
                markLesson={markLesson}
                updating={updating}
                onOpenDetails={openLessonDetails}
              />
            ))
          )}
        </div>
      )}

      {showModal && teacher && (
        <LessonModal
          date={selectedDate}
          teachers={[teacher]}
          students={students}
          groups={groups}
          defaultTeacherId={teacher.id}
          onSave={handleSaveLesson}
          onClose={() => setShowModal(false)}
        />
      )}

      {viewingLesson && (
        <LessonDetailModal
          lesson={viewingLesson}
          teachers={allTeachers.length ? allTeachers : (teacher ? [teacher] : [])}
          students={students}
          isAdmin={false}
          isTeacher
          onUpdate={handleUpdateLesson}
          onDelete={() => {}}
          onClose={() => setViewingLesson(null)}
        />
      )}
      </>
      )}
    </div>
  );
}

function TeacherLessonCard({ lesson, students, expandedLesson, setExpandedLesson, markLesson, updating, onOpenDetails }) {
  return (
    <div
      className={`p-4 bg-white dark:bg-slate-900 rounded-xl border-l-4 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-sm transition-all ${STATUS_BORDER[lesson.status] || "border-l-slate-300 dark:border-l-slate-600"}`}
      onClick={() => setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="text-center min-w-[56px] bg-slate-50 dark:bg-slate-800/60 rounded-xl py-2">
            <p className="text-[10px] text-slate-400 uppercase font-medium">
              {format(new Date(lesson.date), "MMM", { locale: ru })}
            </p>
            <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
              {format(new Date(lesson.date), "d")}
            </p>
            <p className="text-[10px] text-slate-400">
              {format(new Date(lesson.date), "EEE", { locale: ru })}
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{lesson.start_time}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{resolveLessonStudentLabel(lesson, students)}</p>
            <p className="text-xs text-slate-400">{lesson.duration || 60} мин</p>
            {lesson.meeting_link && (
              <a href={lesson.meeting_link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand dark:text-brand hover:underline mt-0.5"
                onClick={e => e.stopPropagation()}>
                <Video className="h-3 w-3" /> Войти на встречу
              </a>
            )}
          </div>
        </div>
        <Badge variant="outline" className={`text-[11px] shrink-0 ${
          lesson.status === "planned" ? "bg-brand-soft text-brand dark:bg-brand-soft/40 dark:text-brand dark:border-brand/40" :
          lesson.status === "completed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" :
          "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
        }`}>
          {STATUS_LABELS[lesson.status] || lesson.status}
        </Badge>
      </div>

      {expandedLesson === lesson.id && lesson.status === "planned" && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenDetails?.(lesson); }}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg border transition-colors bg-brand-soft text-brand border-brand/30 hover:bg-brand-muted dark:bg-brand-soft/40 dark:text-brand dark:border-brand/40"
          >
            <Calendar className="w-3.5 h-3.5" /> Перенести
          </button>
          {[
            { status: "completed", attendance: "attended", icon: CheckCircle2, label: "Ученик присутствовал", cls: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 dark:border-emerald-800" },
            { status: "completed", attendance: "missed", icon: XCircle, label: "Ученик отсутствовал", cls: "bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-950/60 dark:border-orange-800" },
            { status: "cancelled", attendance: null, icon: XCircle, label: "Отменить", cls: "bg-red-50 text-red-600 hover:bg-red-100 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 dark:border-red-800" },
          ].map(({ status, attendance, icon: Icon, label, cls }) => (
            <button
              key={`${status}-${attendance || "none"}`}
              onClick={e => { e.stopPropagation(); markLesson(lesson, status, attendance || "attended"); }}
              disabled={updating === lesson.id}
              className={`flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${cls}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}