import { useState, useEffect } from "react";
import { api } from '@/api';
import { format, isToday, isTomorrow, parseISO, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, Users, GraduationCap, AlertCircle, Clock, ArrowRight, Cake } from "lucide-react";
import StatCard from "./StatCard";
import LessonRow from "./LessonRow";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getGreetingName } from "@/lib/display-name";
import { Card } from "@/components/ui/card";

/** One row per student.id — guards against duplicate API rows. */
function uniqueStudentsById(students) {
  const byId = new Map();
  for (const student of students) {
    const id = String(student?.id ?? "").trim();
    if (id && !byId.has(id)) {
      byId.set(id, student);
    }
  }
  return [...byId.values()];
}

function isActiveStudent(student) {
  return student?.status !== "inactive";
}

function DashboardSection({ title, subtitle, icon: Icon, iconClass, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${iconClass || "text-muted-foreground"}`} />}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="px-2 pb-3">{children}</div>
    </Card>
  );
}

export default function AdminDashboard({ user }) {
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [lowBalanceStudents, setLowBalanceStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.lessons.list("-date", 200),
      api.students.list(),
      api.teachers.list(),
      api.students.lowBalance().catch(() => []),
    ]).then(([l, s, t, lowBalance]) => {
      setLessons(l);
      setStudents(s);
      setTeachers(t);
      setLowBalanceStudents(Array.isArray(lowBalance) ? lowBalance : []);
      setLoading(false);
    });
  }, []);

  const todayLessons = lessons.filter(l => {
    try { return isToday(parseISO(l.date)) && l.status !== "cancelled"; } catch { return false; }
  });
  const tomorrowLessons = lessons.filter(l => {
    try { return isTomorrow(parseISO(l.date)) && l.status !== "cancelled"; } catch { return false; }
  });

  const activeStudents = uniqueStudentsById(students).filter(isActiveStudent);
  const lowBalance = lowBalanceStudents.length;

  const upcomingBirthdays = uniqueStudentsById(students).filter(s => {
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
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const greetingName = getGreetingName(user);
  const heading = greetingName
    ? `${getGreeting()}, ${greetingName}`
    : `${getGreeting()}!`;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto w-full min-w-0">
      <div>
        <h2 className="text-xl font-bold text-foreground">{heading}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Вот что происходит сегодня</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Уроков сегодня" value={todayLessons.length} icon={CalendarDays} color="brand" />
        <StatCard label="Уроков завтра" value={tomorrowLessons.length} icon={Clock} color="muted" />
        <StatCard label="Всего учеников" value={activeStudents.length} icon={GraduationCap} color="muted" />
        <StatCard label="Всего преподавателей" value={teachers.filter(t => t.status !== "inactive").length} icon={Users} color="emerald" />
      </div>

      {lowBalance > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            У {lowBalance} {lowBalance > 1 ? "учеников" : "ученика"} остаток ≤ 2 занятий
            (включая задолженность)
          </p>
          <Link
            to={createPageUrl("LowBalanceStudents")}
            className="ml-auto text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
          >
            Просмотреть <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <DashboardSection title="Уроки сегодня" subtitle={format(new Date(), "d MMMM", { locale: ru })}>
          <div className="space-y-0.5">
            {todayLessons.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Уроков сегодня нет</p>
            ) : (
              todayLessons
                .sort((a, b) => a.start_time?.localeCompare(b.start_time))
                .map(l => (
                  <LessonRow key={l.id} lesson={l} students={students} teachers={teachers} />
                ))
            )}
          </div>
        </DashboardSection>

        <DashboardSection title="Уроки завтра" subtitle={format(new Date(Date.now() + 86400000), "d MMMM", { locale: ru })}>
          <div className="space-y-0.5">
            {tomorrowLessons.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Уроков завтра нет</p>
            ) : (
              tomorrowLessons
                .sort((a, b) => a.start_time?.localeCompare(b.start_time))
                .map(l => (
                  <LessonRow key={l.id} lesson={l} students={students} teachers={teachers} />
                ))
            )}
          </div>
        </DashboardSection>
      </div>

      {upcomingBirthdays.length > 0 && (
        <DashboardSection title="Дни рождения (ближайшие 30 дней)" icon={Cake} iconClass="text-pink-400">
          <div className="divide-y divide-border">
            {upcomingBirthdays.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-2 py-3">
                <div className="w-7 h-7 rounded-full bg-pink-100 dark:bg-pink-950/50 flex items-center justify-center">
                  <span className="text-xs font-semibold text-pink-600 dark:text-pink-400">{s.name[0]}</span>
                </div>
                <span className="text-sm text-foreground flex-1">{s.name}</span>
                <div className="text-right">
                  <p className="text-xs font-semibold text-foreground">{format(s.birthdayDate, "d MMMM")}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.daysUntil === 0 ? "🎂 Сегодня!" : `через ${s.daysUntil} дн.`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>
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
