import { useState, useEffect, useMemo } from "react";
import { api } from '@/api';
import { useAuth } from "@/lib/AuthContext";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths,
  addDays, isSameDay, parseISO, isToday
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import LessonModal from "../components/schedule/LessonModal";
import LessonDetailModal from "../components/schedule/LessonDetailModal";
import { createWeeklyLessonSeries } from "@/lib/recurring-lessons";
import { DAY_HOURS } from "@/lib/time-slots";
import { resolveLessonTeacherLabel } from "@/lib/teacherLabels";
import { resolveLessonStudentLabel, resolveLessonStudentNames } from "@/lib/studentLabels";
import { filterSchoolTeacherLessons } from "@/lib/schoolSchedule";

export default function Schedule() {
  const [view, setView] = useState("month");
  const [current, setCurrent] = useState(new Date());
  const [lessons, setLessons] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewingLesson, setViewingLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [bookings, setBookings] = useState([]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [l, t, s, g, c] = await Promise.all([
        api.lessons.list("-date", 500),
        api.teachers.list(),
        api.students.list(),
        api.groups.list(),
        api.teacherStudentContacts.listMine().catch(() => []),
      ]);
      // School schedule: never mix external tutor lessons into admin teacher calendar.
      setLessons(filterSchoolTeacherLessons(l));
      setTeachers(t);
      setStudents(s);
      setGroups(g);
      setContacts(Array.isArray(c) ? c : []);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить расписание');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedTeacherId) {
      setAvailabilitySlots([]);
      setBookings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [availability, bookingRows] = await Promise.all([
          api.schedule.getTeacherAvailability(selectedTeacherId),
          api.schedule.filterBookings({ teacher_id: selectedTeacherId }),
        ]);
        if (cancelled) return;
        setAvailabilitySlots(availability?.slots || []);
        setBookings(bookingRows.filter((row) => row.status === 'active'));
      } catch {
        if (!cancelled) {
          setAvailabilitySlots([]);
          setBookings([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTeacherId, lessons]);

  // Lessons shown in month/week/day views — filtered by selected teacher when set.
  const visibleLessons = useMemo(() => {
    if (!selectedTeacherId) return lessons;
    return lessons.filter((lesson) => lesson.teacher_id === selectedTeacherId);
  }, [lessons, selectedTeacherId]);

  const navigate = (dir) => {
    if (view === "week") setCurrent(dir === "next" ? addWeeks(current, 1) : subWeeks(current, 1));
    else if (view === "month") setCurrent(dir === "next" ? addMonths(current, 1) : subMonths(current, 1));
    else setCurrent(dir === "next" ? addDays(current, 1) : addDays(current, -1));
  };

  const title = () => {
    if (view === "week") return `${format(startOfWeek(current, { weekStartsOn: 1 }), "d MMM", { locale: ru })} – ${format(endOfWeek(current, { weekStartsOn: 1 }), "d MMM yyyy", { locale: ru })}`;
    if (view === "month") return format(current, "LLLL yyyy", { locale: ru });
    return format(current, "EEEE, d MMMM yyyy", { locale: ru });
  };

  const handleSave = async (data, recurring) => {
    try {
      await createWeeklyLessonSeries(
        (payload) => api.lessons.create(payload),
        data,
        recurring,
      );
      setShowModal(false);
      await load();
    } catch (err) {
      alert(err.message || 'Не удалось сохранить урок');
    }
  };

  const handleUpdate = async (id, data) => {
    const previous = viewingLesson;
    const timeChanged =
      (data.date != null && data.date !== previous?.date) ||
      (data.start_time != null &&
        String(data.start_time).slice(0, 5) !== String(previous?.start_time || "").slice(0, 5)) ||
      (data.duration != null && Number(data.duration) !== Number(previous?.duration || 60));

    try {
      await api.lessons.update(id, data);
      setViewingLesson(null);
      await load();
      alert(
        timeChanged
          ? "Занятие успешно перенесено."
          : "Информация о занятии обновлена.",
      );
    } catch (err) {
      alert(err.message || 'Не удалось обновить урок. Проверьте свободный график и пересечения.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.lessons.delete(id);
      setViewingLesson(null);
      await load();
    } catch (err) {
      alert(err.message || 'Не удалось удалить урок');
    }
  };

  const getLessonsForDay = (day) =>
    visibleLessons.filter(l => {
      try { return isSameDay(parseISO(l.date), day); } catch { return false; }
    }).sort((a, b) => a.start_time?.localeCompare(b.start_time));

  const role = user?.role;
  const isAdmin = role === "admin";

  const HOURS = DAY_HOURS;

  return (
    <div className="flex flex-col h-full dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
        <button
          type="button"
          onClick={() => setCurrent(new Date())}
          className="px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 min-h-[40px]"
        >
          Сегодня
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => navigate("prev")} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-h-touch min-w-touch inline-flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>
          <button type="button" onClick={() => navigate("next")} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-h-touch min-w-touch inline-flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-full sm:w-auto sm:flex-1 order-last sm:order-none truncate">{title()}</h2>
        {isAdmin && (
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-full sm:w-auto sm:max-w-[180px] min-h-[40px]"
          >
            <option value="">Все преподаватели</option>
            {teachers.filter(t => t.status !== 'inactive').map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 overflow-x-auto max-w-full">
          {[["day", "День"], ["week", "Неделя"], ["month", "Месяц"]].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                view === v ? "bg-white dark:bg-slate-900 shadow-sm text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}>
              {label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => { setSelectedDate(format(current, "yyyy-MM-dd")); setShowModal(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 w-full sm:w-auto min-h-[40px]"
          >
            <Plus className="w-4 h-4" /> Новый урок
          </button>
        )}
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm px-4 py-3">{error}</div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : view === "month" ? (
          <MonthView current={current} teachers={teachers} students={students} getLessonsForDay={getLessonsForDay} onDayClick={(d) => {
            setCurrent(d); setView("day");
          }} onLessonClick={setViewingLesson} />
        ) : view === "week" ? (
          <WeekView current={current} teachers={teachers} students={students} hours={HOURS} getLessonsForDay={getLessonsForDay}
            onSlotClick={(date) => { if (isAdmin) { setSelectedDate(date); setShowModal(true); } }}
            onLessonClick={setViewingLesson}
            selectedTeacherId={selectedTeacherId}
            availabilitySlots={availabilitySlots}
            bookings={bookings} />
        ) : (
          <DayView current={current} teachers={teachers} students={students} hours={HOURS} getLessonsForDay={getLessonsForDay}
            onLessonClick={setViewingLesson} />
        )}
      </div>

      {showModal && (
        <LessonModal
          date={selectedDate}
          teachers={teachers}
          students={students}
          contacts={contacts}
          groups={groups}
          defaultTeacherId={selectedTeacherId}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      {viewingLesson && (
        <LessonDetailModal
          lesson={viewingLesson}
          teachers={teachers}
          students={students}
          contacts={contacts}
          isAdmin={isAdmin}
          isTeacher={role === "teacher"}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onStudentsUpdated={(updated) => {
            setViewingLesson(updated);
            setLessons((prev) =>
              prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
            );
          }}
          onClose={() => setViewingLesson(null)}
          showAttendance={isAdmin}
        />
      )}
    </div>
  );
}

const statusColors = {
  planned: "bg-brand-muted text-brand border-brand/30",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-500 border-red-200",
  rescheduled: "bg-amber-100 text-amber-700 border-amber-200",
};

const STATUS_LABELS = {
  planned: "Запланировано",
  completed: "Проведено",
  cancelled: "Отменено",
  rescheduled: "Перенесено",
};

function LessonChip({ lesson, teachers, students, onClick }) {
  const teacherLabel = resolveLessonTeacherLabel(lesson, teachers);
  const names = resolveLessonStudentNames(lesson, students);
  const studentLabel = resolveLessonStudentLabel(lesson, students);
  const displayName = names.length > 1
    ? `${names[0]} +${names.length - 1}`
    : studentLabel;
  const formatIcon = lesson.lesson_format === "offline" ? "🏫" : "💻";
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(lesson); }}
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border cursor-pointer truncate ${statusColors[lesson.status] || statusColors.planned}`}
      title={`${displayName} → ${teacherLabel} @ ${lesson.start_time}`}
    >
      {formatIcon} {lesson.start_time} {displayName}
    </div>
  );
}

function MonthView({ current, teachers, students, getLessonsForDay, onDayClick, onLessonClick }) {
  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const startCal = startOfWeek(start, { weekStartsOn: 1 });
  const endCal = endOfWeek(end, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startCal, end: endCal });

  return (
    <div className="p-4">
      <div className="grid grid-cols-7 mb-2">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
        {days.map(day => {
          const dayLessons = getLessonsForDay(day);
          const inMonth = day.getMonth() === current.getMonth();
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`min-h-[90px] p-2 cursor-pointer transition-colors ${
                inMonth ? "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800" : "bg-slate-50/50 dark:bg-slate-800/40"
              }`}
            >
              <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                isToday(day) ? "bg-primary text-primary-foreground" : inMonth ? "text-slate-700 dark:text-slate-300" : "text-slate-300 dark:text-slate-600"
              }`}>
                {format(day, "d")}
              </span>
              <div className="space-y-0.5">
                {dayLessons.slice(0, 3).map(l => (
                  <LessonChip key={l.id} lesson={l} teachers={teachers} students={students} onClick={onLessonClick} />
                ))}
                {dayLessons.length > 3 && (
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">+{dayLessons.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function dayIndexFromDate(day) {
  const weekday = day.getDay();
  return weekday === 0 ? 6 : weekday - 1;
}

function parseHour(time) {
  return parseInt(String(time || '0').split(':')[0] || 0, 10);
}

function hourOverlapsRange(hour, timeFrom, timeTo) {
  const from = parseHour(timeFrom);
  const toParts = String(timeTo || '').split(':');
  const toHour = parseInt(toParts[0] || 0, 10);
  const toMinute = parseInt(toParts[1] || 0, 10);
  const endHour = toMinute > 0 ? toHour + 1 : toHour;
  return hour >= from && hour < endHour;
}

function getCellAvailabilityState(day, hour, dateStr, availabilitySlots, bookings) {
  const hasBooking = bookings.some(
    (booking) => booking.date === dateStr && hourOverlapsRange(hour, booking.time_from, booking.time_to),
  );
  if (hasBooking) return 'booked';

  if (availabilitySlots.length === 0) {
    return null;
  }

  const daySlots = availabilitySlots.filter((slot) => slot.day === dayIndexFromDate(day));
  const hasAvailability = daySlots.some((slot) => hourOverlapsRange(hour, slot.from, slot.to));
  if (hasAvailability) return 'available';
  return 'blocked';
}

function WeekView({ current, teachers, students, hours, getLessonsForDay, onSlotClick, onLessonClick, selectedTeacherId, availabilitySlots, bookings }) {
  const start = startOfWeek(current, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const showAvailability = Boolean(selectedTeacherId);

  const agenda = days.flatMap((day) => {
    const dayLessons = getLessonsForDay(day);
    if (!dayLessons.length) return [];
    return [{ day, lessons: dayLessons }];
  });

  return (
    <>
      {/* Mobile / tablet: agenda cards — no horizontal scroll */}
      <div className="md:hidden p-3 sm:p-4 space-y-4">
        {agenda.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-12">Нет уроков на этой неделе</p>
        ) : (
          agenda.map(({ day, lessons: dayLessons }) => (
            <section key={day.toISOString()} className="space-y-2">
              <h3 className={`text-sm font-semibold ${isToday(day) ? 'text-brand' : 'text-foreground'}`}>
                {format(day, 'EEEE, d MMMM', { locale: ru })}
              </h3>
              <div className="space-y-2">
                {dayLessons.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onLessonClick(l)}
                    className={`w-full text-left px-3 py-3 min-h-touch rounded-xl border transition-opacity active:opacity-80 ${statusColors[l.status] || statusColors.planned}`}
                  >
                    <p className="text-sm font-semibold">
                      {l.start_time} · {l.duration || 60} мин · {l.lesson_format === 'offline' ? 'Очное' : 'Онлайн'}
                    </p>
                    <p className="text-xs mt-1 break-words">
                      {resolveLessonStudentLabel(l, students)} → {resolveLessonTeacherLabel(l, teachers)}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Desktop week grid */}
      <div className="hidden md:block overflow-x-auto">
    <div className="flex flex-col min-w-[640px]">
      {showAvailability && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-100 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Свободно</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Занято</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Недоступно</span>
        </div>
      )}
      {/* Day headers */}
      <div className="grid grid-cols-8 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
        <div className="py-3" />
        {days.map(day => (
          <div key={day.toISOString()} className={`text-center py-3 ${isToday(day) ? "text-brand" : ""}`}>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">{format(day, "EEEEEE", { locale: ru })}</p>
            <span className={`text-sm font-bold mt-0.5 w-7 h-7 inline-flex items-center justify-center rounded-full ${
              isToday(day) ? "bg-primary text-primary-foreground" : "text-slate-700 dark:text-slate-300"
            }`}>{format(day, "d")}</span>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-8">
        <div>
          {hours.map(h => (
            <div key={h} className="h-16 border-b border-slate-50 dark:border-slate-700 flex items-start justify-end pr-3 pt-1">
              <span className="text-[10px] text-slate-300 dark:text-slate-600 font-medium">{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>
        {days.map(day => {
          const dayLessons = getLessonsForDay(day);
          const dateStr = format(day, "yyyy-MM-dd");
          return (
            <div key={day.toISOString()} className="border-l border-slate-100 dark:border-slate-700">
              {hours.map(h => {
                const slotLessons = dayLessons.filter(l => {
                  const lh = parseInt(l.start_time?.split(":")[0] || 0);
                  return lh === h;
                });
                const cellState = showAvailability
                  ? getCellAvailabilityState(day, h, dateStr, availabilitySlots, bookings)
                  : null;
                const cellBg = cellState === 'booked'
                  ? 'bg-red-50/80 dark:bg-red-950/20'
                  : cellState === 'available'
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20'
                    : cellState === 'blocked'
                      ? 'bg-slate-50/80 dark:bg-slate-800/40'
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50';
                return (
                  <div key={h}
                    className={`h-16 border-b border-slate-50 dark:border-slate-700 cursor-pointer transition-colors relative ${cellBg}`}
                    onClick={() => onSlotClick(dateStr)}
                  >
                    <div className="absolute inset-x-0.5 top-0.5 space-y-0.5">
                      {slotLessons.map(l => (
                        <LessonChip key={l.id} lesson={l} teachers={teachers} students={students} onClick={onLessonClick} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
    </div>
    </>
  );
}

function DayView({ current, teachers, students, hours, getLessonsForDay, onLessonClick }) {
  const dayLessons = getLessonsForDay(current);
  return (
    <div className="max-w-2xl mx-auto p-3 sm:p-6 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
        {hours.map(h => {
          const slotLessons = dayLessons.filter(l => parseInt(l.start_time?.split(":")[0] || 0) === h);
          return (
            <div key={h} className="flex gap-3 sm:gap-4 border-b border-slate-50 dark:border-slate-700 min-h-[56px]">
              <div className="w-12 sm:w-16 flex-shrink-0 flex items-start justify-end pr-2 sm:pr-4 pt-3">
                <span className="text-xs text-slate-300 dark:text-slate-600 font-medium">{String(h).padStart(2, "0")}:00</span>
              </div>
              <div className="flex-1 py-1.5 space-y-1 min-w-0 pr-2">
                {slotLessons.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onLessonClick(l)}
                    className={`w-full text-left px-3 py-2.5 min-h-touch rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${statusColors[l.status] || statusColors.planned}`}
                  >
                    <p className="text-xs font-semibold">{l.start_time} · {l.duration || 60}мин · {l.lesson_format === "offline" ? "Очное" : "Дистанц."}</p>
                    <p className="text-xs break-words">{resolveLessonStudentLabel(l, students)} → {resolveLessonTeacherLabel(l, teachers)}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}