import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format, isToday, isTomorrow, parseISO, addDays } from "date-fns";
import { CalendarDays, Clock, CheckCircle2, XCircle, Video } from "lucide-react";
import StatCard from "./StatCard";

export default function TeacherDashboard({ user }) {
  const [lessons, setLessons] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const teachers = await base44.entities.Teacher.filter({ user_id: user?.id });
    const t = teachers[0];
    setTeacher(t);
    if (t) {
      const ls = await base44.entities.Lesson.filter({ teacher_id: t.id });
      setLessons(ls);
    }
    setLoading(false);
  };

  const markLesson = async (lesson, status) => {
    setUpdating(lesson.id);
    await base44.entities.Lesson.update(lesson.id, { status });
    if (status === "completed" || status === "missed_no_notice") {
      const ids = lesson.student_ids?.length ? lesson.student_ids : lesson.student_id ? [lesson.student_id] : [];
      await Promise.all(ids.map(async (sid) => {
        try {
          const arr = await base44.entities.Student.filter({ id: sid });
          const student = arr[0];
          if (student?.telegram_id) {
            sendTelegramNotification(student.telegram_id, `✅ Урок завершён. Осталось уроков: ${student.lesson_balance ?? 0}`);
          }
        } catch (e) { /* student may have been deleted */ }
      }));
    }
    await loadData();
    setUpdating(null);
  };

  const sendTelegramNotification = async (telegramId, message) => {
    const botToken = localStorage.getItem("telegram_bot_token");
    if (!botToken || !telegramId) return;
    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramId, text: message }),
    }).catch(() => {});
  };

  const todayLessons = lessons.filter(l => {
    try { return isToday(parseISO(l.date)) && l.status !== "cancelled"; } catch { return false; }
  }).sort((a, b) => a.start_time?.localeCompare(b.start_time));

  const upcomingLessons = lessons.filter(l => {
    try {
      const d = parseISO(l.date);
      return d >= new Date() && l.status === "planned";
    } catch { return false; }
  }).sort((a, b) => a.date?.localeCompare(b.date) || a.start_time?.localeCompare(b.start_time)).slice(0, 8);

  const completedThisMonth = lessons.filter(l => l.status === "completed").length;

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Добро пожаловать, {user?.full_name?.split(" ")[0] || "Преподаватель"}</h2>
        <p className="text-sm text-slate-400 mt-0.5">Обзор вашего расписания</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Уроков сегодня" value={todayLessons.length} icon={CalendarDays} color="indigo" />
        <StatCard label="Предстоящие" value={upcomingLessons.length} icon={Clock} color="violet" />
        <StatCard label="Завершено" value={completedThisMonth} icon={CheckCircle2} color="emerald" />
      </div>

      {/* Today */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="px-4 pt-4 pb-2 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">Сегодня — {format(new Date(), "EEEE, MMM d")}</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {todayLessons.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">Уроков сегодня нет</p>
          ) : (
            todayLessons.map(lesson => (
              <div key={lesson.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">
                    {lesson.student_names?.join(", ") || lesson.student_name}
                  </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      lesson.status === "completed" ? "bg-emerald-100 text-emerald-600" :
                      lesson.status === "cancelled" ? "bg-red-100 text-red-500" : "bg-sky-100 text-sky-600"
                    }`}>{{ planned: "Запланировано", completed: "Проведено", cancelled: "Отменено", rescheduled: "Перенесено" }[lesson.status] || lesson.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {lesson.start_time} · {lesson.duration || 60}min
                    </span>
                    {lesson.meeting_link && (
                      <a href={lesson.meeting_link} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                        <Video className="w-3 h-3" /> Войти
                      </a>
                    )}
                  </div>
                </div>
                {lesson.status === "planned" && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => markLesson(lesson, "completed")}
                      disabled={updating === lesson.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Завершить
                    </button>
                    <button
                      onClick={() => markLesson(lesson, "cancelled")}
                      disabled={updating === lesson.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Отменить
                    </button>
                    <button
                      onClick={() => markLesson(lesson, "missed_no_notice")}
                      disabled={updating === lesson.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Пропущено
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upcoming */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="px-4 pt-4 pb-2 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">Предстоящие уроки</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {upcomingLessons.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">Предстоящих уроков нет</p>
          ) : (
            upcomingLessons.map(lesson => (
              <div key={lesson.id} className="flex items-center gap-3 px-4 py-3">
                <div className="text-center w-10 flex-shrink-0">
                  <p className="text-xs font-bold text-indigo-600">{format(parseISO(lesson.date), "d")}</p>
                  <p className="text-[10px] text-slate-400">{format(parseISO(lesson.date), "MMM")}</p>
                </div>
                <div className="w-px h-8 bg-slate-100" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700">
                    {lesson.student_names?.join(", ") || lesson.student_name}
                  </p>
                  <p className="text-xs text-slate-400">{lesson.start_time} · {lesson.duration || 60}мин</p>
                </div>
                {lesson.meeting_link && (
                  <a href={lesson.meeting_link} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                    <Video className="w-3 h-3" /> Войти
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}