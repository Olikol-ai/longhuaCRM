import { useState, useEffect } from "react";
import { api } from '@/api';
import { useAuth } from "@/lib/AuthContext";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths,
  addDays, isSameDay, parseISO, isToday
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import LessonModal from "../components/schedule/LessonModal";
import LessonDetailModal from "../components/schedule/LessonDetailModal";
import { createWeeklyLessonSeries } from "@/lib/recurring-lessons";

export default function Schedule() {
  const [view, setView] = useState("week");
  const [current, setCurrent] = useState(new Date());
  const [lessons, setLessons] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
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
      const [l, t, s] = await Promise.all([
        api.entities.Lesson.list("-date", 500),
        api.entities.Teacher.list(),
        api.entities.Student.list(),
      ]);
      setLessons(l);
      setTeachers(t);
      setStudents(s);
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
        const [availabilityRecords, bookingRows] = await Promise.all([
          api.entities.TeacherAvailability.filter({ teacher_id: selectedTeacherId }),
          api.entities.TeacherAvailabilityBooking.filter({ teacher_id: selectedTeacherId }),
        ]);
        if (cancelled) return;
        setAvailabilitySlots(availabilityRecords[0]?.slots || []);
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

  const navigate = (dir) => {
    if (view === "week") setCurrent(dir === "next" ? addWeeks(current, 1) : subWeeks(current, 1));
    else if (view === "month") setCurrent(dir === "next" ? addMonths(current, 1) : subMonths(current, 1));
    else setCurrent(dir === "next" ? addDays(current, 1) : addDays(current, -1));
  };

  const title = () => {
    if (view === "week") return `${format(startOfWeek(current, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(current, { weekStartsOn: 1 }), "MMM d, yyyy")}`;
    if (view === "month") return format(current, "MMMM yyyy");
    return format(current, "EEEE, MMMM d, yyyy");
  };

  const handleSave = async (data, recurring) => {
    try {
      await createWeeklyLessonSeries(
        (payload) => api.entities.Lesson.create(payload),
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
    try {
      await api.entities.Lesson.update(id, data);
      setViewingLesson(null);
      await load();
    } catch (err) {
      alert(err.message || 'Не удалось обновить урок');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.entities.Lesson.delete(id);
      setViewingLesson(null);
      await load();
    } catch (err) {
      alert(err.message || 'Не удалось удалить урок');
    }
  };

  const getLessonsForDay = (day) =>
    lessons.filter(l => {
      try { return isSameDay(parseISO(l.date), day); } catch { return false; }
    }).sort((a, b) => a.start_time?.localeCompare(b.start_time));

  const role = user?.role;
  const isAdmin = role === "admin";

  const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am - 8pm

  return (
    <div className="flex flex-col h-full dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
        <button
          onClick={() => setCurrent(new Date())}
          className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
        >
          Сегодня
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate("prev")} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <button onClick={() => navigate("next")} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex-1">{title()}</h2>
        {isAdmin && (
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 max-w-[180px]"
          >
            <option value="">Все преподаватели</option>
            {teachers.filter(t => t.status !== 'inactive').map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {[["day", "День"], ["week", "Неделя"], ["month", "Месяц"]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                view === v ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700"
              }`}>
              {label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button
            onClick={() => { setSelectedDate(format(current, "yyyy-MM-dd")); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Новый урок
          </button>
        )}
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : view === "month" ? (
          <MonthView current={current} getLessonsForDay={getLessonsForDay} onDayClick={(d) => {
            setCurrent(d); setView("day");
          }} onLessonClick={setViewingLesson} />
        ) : view === "week" ? (
          <WeekView current={current} hours={HOURS} getLessonsForDay={getLessonsForDay}
            onSlotClick={(date) => { if (isAdmin) { setSelectedDate(date); setShowModal(true); } }}
            onLessonClick={setViewingLesson}
            selectedTeacherId={selectedTeacherId}
            availabilitySlots={availabilitySlots}
            bookings={bookings} />
        ) : (
          <DayView current={current} hours={HOURS} getLessonsForDay={getLessonsForDay}
            onLessonClick={setViewingLesson} />
        )}
      </div>

      {showModal && (
        <LessonModal
          date={selectedDate}
          teachers={teachers}
          students={students}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      {viewingLesson && (
        <LessonDetailModal
          lesson={viewingLesson}
          teachers={teachers}
          students={students}
          isAdmin={isAdmin}
          isTeacher={role === "teacher"}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={() => setViewingLesson(null)}
        />
      )}
    </div>
  );
}

const statusColors = {
  planned: "bg-indigo-100 text-indigo-700 border-indigo-200",
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

function LessonChip({ lesson, onClick }) {
  const displayName = lesson.student_names?.length > 1
    ? `${lesson.student_names[0]} +${lesson.student_names.length - 1}`
    : (lesson.student_name || lesson.teacher_name);
  const formatIcon = lesson.lesson_format === "offline" ? "🏫" : "💻";
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(lesson); }}
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border cursor-pointer truncate ${statusColors[lesson.status] || statusColors.planned}`}
      title={`${displayName} → ${lesson.teacher_name} @ ${lesson.start_time}`}
    >
      {formatIcon} {lesson.start_time} {displayName}
    </div>
  );
}

function MonthView({ current, getLessonsForDay, onDayClick, onLessonClick }) {
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
      <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-xl overflow-hidden">
        {days.map(day => {
          const dayLessons = getLessonsForDay(day);
          const inMonth = day.getMonth() === current.getMonth();
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`min-h-[90px] p-2 cursor-pointer transition-colors ${
                inMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50/50"
              }`}
            >
              <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                isToday(day) ? "bg-indigo-600 text-white" : inMonth ? "text-slate-700" : "text-slate-300"
              }`}>
                {format(day, "d")}
              </span>
              <div className="space-y-0.5">
                {dayLessons.slice(0, 3).map(l => (
                  <LessonChip key={l.id} lesson={l} onClick={onLessonClick} />
                ))}
                {dayLessons.length > 3 && (
                  <span className="text-[9px] text-slate-400">+{dayLessons.length - 3} more</span>
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
  const daySlots = availabilitySlots.filter((slot) => slot.day === dayIndexFromDate(day));
  const hasAvailability = daySlots.some((slot) => hourOverlapsRange(hour, slot.from, slot.to));
  const hasBooking = bookings.some(
    (booking) => booking.date === dateStr && hourOverlapsRange(hour, booking.time_from, booking.time_to),
  );
  if (hasBooking) return 'booked';
  if (hasAvailability) return 'available';
  return 'blocked';
}

function WeekView({ current, hours, getLessonsForDay, onSlotClick, onLessonClick, selectedTeacherId, availabilitySlots, bookings }) {
  const start = startOfWeek(current, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const showAvailability = Boolean(selectedTeacherId);

  return (
    <div className="flex flex-col min-w-[640px]">
      {showAvailability && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-100 dark:border-slate-700 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Свободно</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Занято</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Недоступно</span>
        </div>
      )}
      {/* Day headers */}
      <div className="grid grid-cols-8 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
        <div className="py-3" />
        {days.map(day => (
          <div key={day.toISOString()} className={`text-center py-3 ${isToday(day) ? "text-indigo-600" : ""}`}>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">{format(day, "EEE")}</p>
            <span className={`text-sm font-bold mt-0.5 w-7 h-7 inline-flex items-center justify-center rounded-full ${
              isToday(day) ? "bg-indigo-600 text-white" : "text-slate-700 dark:text-slate-300"
            }`}>{format(day, "d")}</span>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-8">
        <div>
          {hours.map(h => (
            <div key={h} className="h-16 border-b border-slate-50 dark:border-slate-700 flex items-start justify-end pr-3 pt-1">
              <span className="text-[10px] text-slate-300 dark:text-slate-600 font-medium">{h}:00</span>
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
                        <LessonChip key={l.id} lesson={l} onClick={onLessonClick} />
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
  );
}

function DayView({ current, hours, getLessonsForDay, onLessonClick }) {
  const dayLessons = getLessonsForDay(current);
  return (
    <div className="max-w-2xl mx-auto p-6 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
        {hours.map(h => {
          const slotLessons = dayLessons.filter(l => parseInt(l.start_time?.split(":")[0] || 0) === h);
          return (
            <div key={h} className="flex gap-4 border-b border-slate-50 dark:border-slate-700 min-h-[56px]">
              <div className="w-16 flex-shrink-0 flex items-start justify-end pr-4 pt-3">
                <span className="text-xs text-slate-300 dark:text-slate-600 font-medium">{h}:00</span>
              </div>
              <div className="flex-1 py-1.5 space-y-1">
                {slotLessons.map(l => (
                  <div key={l.id} onClick={() => onLessonClick(l)}
                    className={`px-3 py-2 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${statusColors[l.status] || statusColors.planned}`}
                  >
                    <p className="text-xs font-semibold">{l.start_time} · {l.duration || 60}мин · {l.lesson_format === "offline" ? "Очное" : "Дистанц."}</p>
                    <p className="text-xs">{l.student_names?.join(", ") || l.student_name} → {l.teacher_name}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}