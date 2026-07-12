import React, { useState, useEffect, useMemo } from "react";
import { api } from '@/api';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Video,
  Calendar,
  List,
  ArrowUpDown,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { useAuth } from "@/lib/AuthContext";
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
  completed: "Завершено",
  cancelled: "Отменено",
  rescheduled: "Перенесено",
  missed: "Пропущено",
  missed_no_notice: "Без предупреждения",
};

const WEEK_DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function StudentLessons() {
  const { user, isLoadingAuth } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("calendar"); // "calendar" | "week" | "list"
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [filter, setFilter] = useState("all"); // "all" | "upcoming" | "past"
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
    const [allStudents, allLessons] = await Promise.all([
      api.students.list(),
      api.lessons.list("-date", 300),
    ]);
    const student = allStudents.find((s) => s.user_id === user.id || s.email === user.email);
    if (student) {
      setLessons(allLessons.filter((l) => l.student_id === student.id));
    }
    setLoading(false);
  };

  const getLessonsForDay = (dateStr) =>
    lessons
      .filter((l) => l.date === dateStr)
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  // Monthly calendar grid
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Weekly calendar
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // List view
  const listLessons = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    let filtered = [...lessons];
    if (filter === "upcoming") filtered = filtered.filter((l) => l.date >= todayStr && l.status === "planned");
    if (filter === "past") filtered = filtered.filter((l) => l.date < todayStr || l.status !== "planned");
    return filtered.sort((a, b) => {
      const cmp = `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`);
      return sortAsc ? cmp : -cmp;
    });
  }, [lessons, filter, sortAsc]);

  if (loading || isLoadingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const selectedDayStr = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedDayLessons = selectedDayStr ? getLessonsForDay(selectedDayStr) : [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Мои уроки</h1>
        <button onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors ml-auto"
          title="Сменить тему">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        {/* View switcher */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {[
            { id: "calendar", icon: Calendar, label: "Месяц" },
            { id: "week", icon: Calendar, label: "Неделя" },
            { id: "list", icon: List, label: "Список" },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => { setViewMode(v.id); setSelectedDay(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === v.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <v.icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ==================== MONTHLY CALENDAR ==================== */}
      {viewMode === "calendar" && (
        <div>
          {/* Nav */}
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

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {WEEK_DAYS_RU.map((d) => (
                <div key={d} className="py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
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
                    className={`min-h-[80px] p-2 border-b border-r border-slate-100 cursor-pointer transition-colors
                      ${isSelected ? "bg-indigo-50" : "hover:bg-slate-50"}
                      ${!inMonth ? "opacity-40" : ""}
                    `}
                  >
                    <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday(day) ? "bg-indigo-600 text-white" : "text-slate-700"}
                    `}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayLessons.slice(0, 2).map((lesson) => (
                        <div
                          key={lesson.id}
                          className={`text-[10px] font-medium text-white px-1.5 py-0.5 rounded-md truncate ${STATUS_BG[lesson.status] || "bg-slate-400"}`}
                        >
                          {lesson.start_time} {lesson.teacher_name?.split(" ")[0] || ""}
                        </div>
                      ))}
                      {dayLessons.length > 2 && (
                        <p className="text-[9px] text-slate-400 pl-1">+{dayLessons.length - 2} ещё</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 capitalize">
                {format(selectedDay, "EEEE, d MMMM", { locale: ru })}
              </h3>
              {selectedDayLessons.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6 bg-white rounded-xl border border-dashed border-slate-200">
                  Уроков нет
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayLessons.map((lesson) => (
                    <LessonCard key={lesson.id} lesson={lesson} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== WEEKLY CALENDAR ==================== */}
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
                <div key={i} className={`rounded-2xl border p-3 ${isToday(day) ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-white"}`}>
                  <div className="text-center mb-3">
                    <p className="text-[11px] text-slate-400 uppercase font-medium">{WEEK_DAYS_RU[i]}</p>
                    <div className={`text-xl font-bold mx-auto mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${isToday(day) ? "bg-indigo-600 text-white" : "text-slate-900"}`}>
                      {format(day, "d")}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {dayLessons.length === 0 ? (
                      <div className="text-xs text-slate-300 text-center py-3">—</div>
                    ) : (
                      dayLessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className={`p-2.5 bg-white rounded-xl border-l-4 border border-slate-100 shadow-sm ${STATUS_BORDER[lesson.status] || "border-l-slate-300"}`}
                        >
                          <p className="text-xs font-bold text-slate-900">{lesson.start_time}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5 truncate">{lesson.teacher_name}</p>
                          <p className="text-[10px] text-slate-400">{lesson.duration || 60} мин</p>
                          {lesson.meeting_link && (
                            <a
                              href={lesson.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:underline mt-1"
                            >
                              <Video className="h-2.5 w-2.5" /> Войти
                            </a>
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

      {/* ==================== LIST VIEW ==================== */}
      {viewMode === "list" && (
        <div>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            {/* Filter */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {[["all", "Все"], ["upcoming", "Предстоящие"], ["past", "История"]].map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    filter === f ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Sort */}
            <Button variant="outline" size="sm" onClick={() => setSortAsc((v) => !v)} className="h-8 gap-1.5 text-xs">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortAsc ? "Сначала ближайшие" : "Сначала дальние"}
            </Button>
          </div>

          {listLessons.length === 0 ? (
            <Card className="p-10 text-center border-dashed">
              <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Уроков нет</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {listLessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LessonCard({ lesson }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border-l-4 border border-slate-200 hover:shadow-sm transition-all ${STATUS_BORDER[lesson.status] || "border-l-slate-300"}`}>
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
          <p className="text-sm text-slate-600">{lesson.teacher_name}</p>
          <p className="text-xs text-slate-400">{lesson.duration || 60} мин</p>
          {lesson.notes && <p className="text-xs text-slate-400 mt-0.5">{lesson.notes}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 ml-auto sm:ml-0">
        <Badge className={`text-[11px] ${lesson.status === "planned" ? "bg-blue-50 text-blue-700" : lesson.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`} variant="outline">
          {STATUS_LABELS[lesson.status] || lesson.status}
        </Badge>
        {lesson.meeting_link && lesson.status === "planned" && (
          <a
            href={lesson.meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
          >
            <Video className="h-3.5 w-3.5" /> Войти
          </a>
        )}
      </div>
    </div>
  );
}