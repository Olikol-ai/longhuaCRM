import { useState, useEffect } from "react";
import { api } from '@/api';
import { format, isToday, isTomorrow, parseISO, differenceInDays } from "date-fns";
import { CalendarDays, Users, GraduationCap, AlertCircle, Clock, TrendingUp, ArrowRight, Cake } from "lucide-react";
import StatCard from "./StatCard";
import LessonRow from "./LessonRow";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getGreetingName } from "@/lib/display-name";

export default function AdminDashboard({ user }) {
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.entities.Lesson.list("-date", 200),
      api.entities.Student.list(),
      api.entities.Teacher.list(),
      api.entities.Payment.list("-payment_date", 100),
    ]).then(([l, s, t, p]) => {
      setLessons(l);
      setStudents(s);
      setTeachers(t);
      setPayments(p);
      setLoading(false);
    });
  }, []);

  const todayLessons = lessons.filter(l => {
    try { return isToday(parseISO(l.date)) && l.status !== "cancelled"; } catch { return false; }
  });
  const tomorrowLessons = lessons.filter(l => {
    try { return isTomorrow(parseISO(l.date)) && l.status !== "cancelled"; } catch { return false; }
  });

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const lowBalance = students.filter(s => (s.lesson_balance || 0) <= 2).length;

  // Birthdays in next 30 days
  const upcomingBirthdays = students.filter(s => {
    if (!s.birthday || s.status === "inactive") return false;
    try {
      const today = new Date();
      const bday = parseISO(s.birthday);
      const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      const nextYear = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
      const target = thisYear >= today ? thisYear : nextYear;
      const diff = differenceInDays(target, today);
      return diff >= 0 && diff <= 30;
    } catch { return false; }
  }).map(s => {
    const today = new Date();
    const bday = parseISO(s.birthday);
    const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    const nextYear = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
    const target = thisYear >= today ? thisYear : nextYear;
    return { ...s, daysUntil: differenceInDays(target, today), birthdayDate: target };
  }).sort((a, b) => a.daysUntil - b.daysUntil);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const userName = getGreetingName(user) || "Администратор";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-800">{getGreeting()}, {userName}</h2>
        <p className="text-sm text-slate-400 mt-0.5">Вот что происходит сегодня</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Уроков сегодня" value={todayLessons.length} icon={CalendarDays} color="indigo" />
        <StatCard label="Уроков завтра" value={tomorrowLessons.length} icon={Clock} color="violet" />
        <StatCard label="Всего учеников" value={students.filter(s => s.status !== "inactive").length} icon={GraduationCap} color="sky" />
        <StatCard label="Всего преподавателей" value={teachers.filter(t => t.status !== "inactive").length} icon={Users} color="emerald" />
      </div>

      {/* Alerts */}
      {lowBalance > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            У {lowBalance} {lowBalance > 1 ? "учеников" : "ученика"} осталось 2 урока или меньше
          </p>
          <Link to="/UserManagement" className="ml-auto text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1">
            View <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-slate-700">Уроки сегодня</h3>
            <span className="text-xs text-slate-400">{format(new Date(), "MMM d")}</span>
          </div>
          <div className="px-2 pb-3 space-y-0.5">
            {todayLessons.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Уроков сегодня нет</p>
            ) : (
              todayLessons
                .sort((a, b) => a.start_time?.localeCompare(b.start_time))
                .map(l => <LessonRow key={l.id} lesson={l} />)
            )}
          </div>
        </div>

        {/* Tomorrow */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-slate-700">Уроки завтра</h3>
            <span className="text-xs text-slate-400">{format(new Date(Date.now() + 86400000), "MMM d")}</span>
          </div>
          <div className="px-2 pb-3 space-y-0.5">
            {tomorrowLessons.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Уроков завтра нет</p>
            ) : (
              tomorrowLessons
                .sort((a, b) => a.start_time?.localeCompare(b.start_time))
                .map(l => <LessonRow key={l.id} lesson={l} />)
            )}
          </div>
        </div>
      </div>

      {/* Upcoming birthdays */}
      {upcomingBirthdays.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <Cake className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-slate-700">Дни рождения (ближайшие 30 дней)</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {upcomingBirthdays.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center">
                  <span className="text-xs font-semibold text-pink-600">{s.name[0]}</span>
                </div>
                <span className="text-sm text-slate-700 flex-1">{s.name}</span>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-700">{format(s.birthdayDate, "d MMMM")}</p>
                  <p className="text-[10px] text-slate-400">
                    {s.daysUntil === 0 ? "🎂 Сегодня!" : `через ${s.daysUntil} дн.`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low balance students */}
      {lowBalance > 0 && (
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-slate-700">Ученики с низким балансом</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {students
              .filter(s => (s.lesson_balance || 0) <= 2 && s.status !== "inactive")
              .map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-xs font-semibold text-indigo-600">{s.name[0]}</span>
                  </div>
                  <span className="text-sm text-slate-700 flex-1">{s.name}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    (s.lesson_balance || 0) === 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                  }`}>
                    Осталось уроков: {s.lesson_balance || 0}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Доброе утро";
  if (h < 17) return "Добрый день";
  return "Добрый вечер";
}