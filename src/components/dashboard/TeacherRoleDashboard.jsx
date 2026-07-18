import { useState, useEffect } from "react";
import { api } from '@/api';
import { format, isToday, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, Clock, CheckCircle2, XCircle, Video } from "lucide-react";
import StatCard from "./StatCard";
import { getGreetingName } from "@/lib/display-name";
import { Card } from "@/components/ui/card";
import { resolveLessonStudentLabel } from "@/lib/studentLabels";

const STATUS_LABELS = {
  planned: "Запланировано",
  completed: "Проведено",
  cancelled: "Отменено",
  rescheduled: "Перенесено",
};

const statusBadge = {
  completed: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-500 dark:bg-red-950/50 dark:text-red-400",
  planned: "bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400",
};

export default function TeacherRoleDashboard({ user }) {
  const [lessons, setLessons] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const teachers = await api.teachers.filter({ user_id: user?.id });
    const t = teachers[0];
    setTeacher(t);
    if (t) {
      const ls = await api.lessons.filter({ teacher_id: t.id });
      setLessons(ls);
    }
    setLoading(false);
  };

  const markLesson = async (lesson, status) => {
    setUpdating(lesson.id);
    await api.lessons.update(lesson.id, { status });
    await loadData();
    setUpdating(null);
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
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-foreground">Добро пожаловать, {getGreetingName(user) || "Преподаватель"}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Обзор вашего расписания</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Уроков сегодня" value={todayLessons.length} icon={CalendarDays} color="indigo" />
        <StatCard label="Предстоящие" value={upcomingLessons.length} icon={Clock} color="violet" />
        <StatCard label="Завершено" value={completedThisMonth} icon={CheckCircle2} color="emerald" />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pt-4 pb-2 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Сегодня — {format(new Date(), "EEEE, d MMMM", { locale: ru })}</h3>
        </div>
        <div className="divide-y divide-border">
          {todayLessons.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Уроков сегодня нет</p>
          ) : (
            todayLessons.map(lesson => (
              <div key={lesson.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {resolveLessonStudentLabel(lesson, [])}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusBadge[lesson.status] || statusBadge.planned}`}>
                      {STATUS_LABELS[lesson.status] || lesson.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {lesson.start_time} · {lesson.duration || 60}min
                    </span>
                    {lesson.meeting_link && (
                      <a href={lesson.meeting_link} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1">
                        <Video className="w-3 h-3" /> Войти
                      </a>
                    )}
                  </div>
                </div>
                {lesson.status === "planned" && (
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    <button
                      onClick={() => markLesson(lesson, "completed")}
                      disabled={updating === lesson.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Завершить
                    </button>
                    <button
                      onClick={() => markLesson(lesson, "cancelled")}
                      disabled={updating === lesson.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60 rounded-lg transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Отменить
                    </button>
                    <button
                      onClick={() => markLesson(lesson, "missed_no_notice")}
                      disabled={updating === lesson.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:hover:bg-orange-950/60 rounded-lg transition-colors"
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
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 pt-4 pb-2 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Предстоящие уроки</h3>
        </div>
        <div className="divide-y divide-border">
          {upcomingLessons.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Предстоящих уроков нет</p>
          ) : (
            upcomingLessons.map(lesson => (
              <div key={lesson.id} className="flex items-center gap-3 px-4 py-3">
                <div className="text-center w-10 flex-shrink-0">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{format(parseISO(lesson.date), "d")}</p>
                  <p className="text-[10px] text-muted-foreground">{format(parseISO(lesson.date), "LLL", { locale: ru })}</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {resolveLessonStudentLabel(lesson, [])}
                  </p>
                  <p className="text-xs text-muted-foreground">{lesson.start_time} · {lesson.duration || 60}мин</p>
                </div>
                {lesson.meeting_link && (
                  <a href={lesson.meeting_link} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1">
                    <Video className="w-3 h-3" /> Войти
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
