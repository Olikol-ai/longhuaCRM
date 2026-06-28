import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import TeacherAvailabilityTab from "@/components/schedule/TeacherAvailabilityTab";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Loader2, Video, Plus,
  CheckCircle2, XCircle, Clock, Calendar, List, Sun, Moon,
} from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks,
  isToday, isSameMonth, parseISO, addDays,
} from "date-fns";
import { ru } from "date-fns/locale";
import LessonModal from "@/components/schedule/LessonModal";

const STATUS_BG = {
  planned: "bg-indigo-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-400",
  rescheduled: "bg-amber-500",
  missed: "bg-orange-400",
  missed_no_notice: "bg-red-700",
};
const STATUS_BORDER = {
  planned: "border-l-indigo-500",
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
  const [lessons, setLessons] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [allTeachers, setAllTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week"); // "month" | "week" | "list"
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [mainTab, setMainTab] = useState("schedule"); // "schedule" | "availability"
  const { theme, toggleTheme } = useTheme();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const me = await base44.auth.me();
    const [teachers, allLessons, allStudents] = await Promise.all([
      base44.entities.Teacher.list(),
      base44.entities.Lesson.list("-date", 500),
      base44.entities.Student.list(),
    ]);
    const t = teachers.find(t => t.user_id === me.id || t.email === me.email);
    setAllTeachers(teachers);
    // Ученики, назначенные текущему преподавателю
    setStudents(allStudents.filter(s => s.assigned_teacher === t?.id || !t));
    if (t) {
      setTeacher(t);
      setLessons(allLessons.filter(l => l.teacher_id === t.id));
    }
    setLoading(false);
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

  const markLesson = async (lesson, status) => {
    setUpdating(lesson.id);
    await base44.entities.Lesson.update(lesson.id, { status });
    if (status === "completed" || status === "missed_no_notice") {
      const ids = lesson.student_ids?.length ? lesson.student_ids : lesson.student_id ? [lesson.student_id] : [];
      await Promise.all(ids.map(async sid => {
        const arr = await base44.entities.Student.filter({ id: sid });
        const s = arr[0];
        if (s?.telegram_id) {
          const newBalance = s.lesson_balance ?? 0;
          const msg = status === "completed"
            ? `✅ Урок завершён!\n\n📅 ${lesson.date} в ${lesson.start_time}\n💡 Осталось уроков: ${newBalance}`
            : `⚠️ Урок пропущен без предупреждения\n\n📅 ${lesson.date} в ${lesson.start_time}\nБаланс списан. Осталось уроков: ${newBalance}`;
          base44.functions.invoke("sendTelegramMessage", { chat_id: s.telegram_id, text: msg }).catch(() => {});
          if (newBalance === 0) {
            const balMsg = `⚠️ Баланс уроков исчерпан!\n\nТекущий урок (${lesson.date} в ${lesson.start_time}) не оплачен — на вашем счёте 0 уроков.\n\nПожалуйста, пополните баланс, чтобы продолжить занятия. Свяжитесь с администратором.`;
            base44.functions.invoke("sendTelegramMessage", { chat_id: s.telegram_id, text: balMsg }).catch(() => {});
          }
        }
      }));
    }
    setExpandedLesson(null);
    setUpdating(null);
    loadData();
  };

  const handleSaveLesson = async (data, recurring) => {
    if (!teacher) return;
    const lessonData = { ...data, teacher_id: teacher.id, teacher_name: teacher.name };
    if (recurring) {
      let d = parseISO(lessonData.date);
      const groupId = Date.now().toString();
      for (let i = 0; i < 4; i++) {
        await base44.entities.Lesson.create({ ...lessonData, date: format(d, "yyyy-MM-dd"), is_recurring: true, recurring_group_id: groupId });
        d = addDays(d, 7);
      }
    } else {
      await base44.entities.Lesson.create(lessonData);
    }
    setShowModal(false);
    loadData();
  };

  const openNewLesson = (dateStr) => {
    setSelectedDate(dateStr || format(new Date(), "yyyy-MM-dd"));
    setShowModal(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>;
  }

  const selectedDayStr = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedDayLessons = selectedDayStr ? getLessonsForDay(selectedDayStr) : [];

  // List: all lessons sorted
  const listLessons = [...lessons].sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto dark:bg-slate-950 min-h-screen">
      {/* Main tabs */}
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setMainTab("schedule")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              mainTab === "schedule" ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Моё расписание
          </button>
          <button
            onClick={() => setMainTab("availability")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              mainTab === "availability" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
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
                  viewMode === v.id ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Button onClick={() => openNewLesson(null)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
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
            <h2 className="text-base font-semibold text-slate-900 min-w-[180px] text-center capitalize">
              {format(currentDate, "LLLL yyyy", { locale: ru })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="ml-2 text-xs">
              Сегодня
            </Button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700">
              {WEEK_DAYS_RU.map((d) => (
                <div key={d} className="py-3 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
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
                      ${isSelected ? "bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800"}
                      ${!inMonth ? "opacity-40" : ""}
                    `}
                  >
                    <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday(day) ? "bg-indigo-600 text-white" : "text-slate-700 dark:text-slate-300"}
                    `}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayLessons.slice(0, 2).map((lesson) => (
                        <div key={lesson.id} className={`text-[10px] font-medium text-white px-1.5 py-0.5 rounded-md truncate ${STATUS_BG[lesson.status] || "bg-slate-400"}`}>
                          {lesson.start_time} {lesson.student_names?.[0]?.split(" ")[0] || lesson.student_name?.split(" ")[0] || ""}
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
                <Button size="sm" onClick={() => openNewLesson(selectedDayStr)} className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Добавить
                </Button>
              </div>
              {selectedDayLessons.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">Уроков нет</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayLessons.map((lesson) => (
                    <TeacherLessonCard key={lesson.id} lesson={lesson} expandedLesson={expandedLesson} setExpandedLesson={setExpandedLesson} markLesson={markLesson} updating={updating} />
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
            <h2 className="text-base font-semibold text-slate-900 min-w-[220px] text-center">
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
                <div key={i} className={`rounded-2xl border p-3 ${isToday(day) ? "border-indigo-300 bg-indigo-50/40 dark:bg-indigo-900/20 dark:border-indigo-700" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase font-medium">{WEEK_DAYS_RU[i]}</p>
                      <div className={`text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full mt-0.5 ${isToday(day) ? "bg-indigo-600 text-white" : "text-slate-900"}`}>
                        {format(day, "d")}
                      </div>
                    </div>
                    <button
                      onClick={() => openNewLesson(dayStr)}
                      className="h-7 w-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 text-indigo-600" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dayLessons.length === 0 ? (
                      <div className="text-xs text-slate-300 text-center py-3">—</div>
                    ) : (
                      dayLessons.map(lesson => (
                        <div
                          key={lesson.id}
                          className={`p-2.5 bg-white rounded-xl border-l-4 border border-slate-100 shadow-sm cursor-pointer hover:shadow-md transition-all ${STATUS_BORDER[lesson.status] || "border-l-slate-300"}`}
                          onClick={() => setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id)}
                        >
                          <p className="text-xs font-bold text-slate-900">{lesson.start_time}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                            {lesson.student_names?.join(", ") || lesson.student_name || "—"}
                          </p>
                          <p className="text-[10px] text-slate-400">{lesson.duration || 60} мин</p>
                          {lesson.meeting_link && (
                            <a href={lesson.meeting_link} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:underline mt-1"
                              onClick={e => e.stopPropagation()}>
                              <Video className="h-2.5 w-2.5" /> Войти
                            </a>
                          )}
                          {expandedLesson === lesson.id && lesson.status === "planned" && (
                            <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                              {[
                                { status: "completed", icon: CheckCircle2, label: "Проведено", cls: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
                                { status: "cancelled", icon: XCircle, label: "Отменить", cls: "bg-red-50 text-red-600 hover:bg-red-100" },
                                { status: "missed", icon: XCircle, label: "Пропущено", cls: "bg-orange-50 text-orange-600 hover:bg-orange-100" },
                                { status: "missed_no_notice", icon: Clock, label: "Без предупреждения", cls: "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200" },
                              ].map(({ status, icon: Icon, label, cls }) => (
                                <button
                                  key={status}
                                  onClick={e => { e.stopPropagation(); markLesson(lesson, status); }}
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
              <TeacherLessonCard key={lesson.id} lesson={lesson} expandedLesson={expandedLesson} setExpandedLesson={setExpandedLesson} markLesson={markLesson} updating={updating} />
            ))
          )}
        </div>
      )}

      {showModal && teacher && (
        <LessonModal
          date={selectedDate}
          teachers={[teacher]}
          students={students}
          defaultTeacherId={teacher.id}
          onSave={handleSaveLesson}
          onClose={() => setShowModal(false)}
        />
      )}
      </>
      )}
    </div>
  );
}

function TeacherLessonCard({ lesson, expandedLesson, setExpandedLesson, markLesson, updating }) {
  return (
    <div
      className={`p-4 bg-white rounded-xl border-l-4 border border-slate-200 cursor-pointer hover:shadow-sm transition-all ${STATUS_BORDER[lesson.status] || "border-l-slate-300"}`}
      onClick={() => setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="text-center min-w-[56px] bg-slate-50 rounded-xl py-2">
            <p className="text-[10px] text-slate-400 uppercase font-medium">
              {format(new Date(lesson.date), "MMM", { locale: ru })}
            </p>
            <p className="text-xl font-bold text-slate-900 leading-tight">
              {format(new Date(lesson.date), "d")}
            </p>
            <p className="text-[10px] text-slate-400">
              {format(new Date(lesson.date), "EEE", { locale: ru })}
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">{lesson.start_time}</p>
            <p className="text-sm text-slate-600">{lesson.student_names?.join(", ") || lesson.student_name || "—"}</p>
            <p className="text-xs text-slate-400">{lesson.duration || 60} мин</p>
            {lesson.meeting_link && (
              <a href={lesson.meeting_link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-0.5"
                onClick={e => e.stopPropagation()}>
                <Video className="h-3 w-3" /> Войти на встречу
              </a>
            )}
          </div>
        </div>
        <Badge variant="outline" className={`text-[11px] shrink-0 ${
          lesson.status === "planned" ? "bg-blue-50 text-blue-700" :
          lesson.status === "completed" ? "bg-emerald-50 text-emerald-700" :
          "bg-red-50 text-red-600"
        }`}>
          {STATUS_LABELS[lesson.status] || lesson.status}
        </Badge>
      </div>

      {expandedLesson === lesson.id && lesson.status === "planned" && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
          {[
            { status: "completed", icon: CheckCircle2, label: "Проведено", cls: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" },
            { status: "cancelled", icon: XCircle, label: "Отменить", cls: "bg-red-50 text-red-600 hover:bg-red-100 border-red-200" },
            { status: "missed", icon: XCircle, label: "Пропущено", cls: "bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-200" },
            { status: "missed_no_notice", icon: Clock, label: "Без предупреждения", cls: "bg-red-50 text-red-700 hover:bg-red-100 border-red-300" },
          ].map(({ status, icon: Icon, label, cls }) => (
            <button
              key={status}
              onClick={e => { e.stopPropagation(); markLesson(lesson, status); }}
              disabled={updating === lesson.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${cls}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}