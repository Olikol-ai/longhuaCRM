import { useEffect, useState } from "react";
import { api } from '@/api';
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, Users, GraduationCap, AlertCircle, Clock, ArrowRight, Cake } from "lucide-react";
import StatCard from "./StatCard";
import LessonRow from "./LessonRow";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getGreetingName } from "@/lib/display-name";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { userFacingError } from "@/lib/userFacingError";

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

const EMPTY_SUMMARY = {
  timezone: null,
  today: null,
  tomorrow: null,
  counts: {
    teachers: 0,
    students: 0,
    lessons_today: 0,
    lessons_tomorrow: 0,
    low_balance_students: 0,
  },
  lessons_today: [],
  lessons_tomorrow: [],
  upcoming_birthdays: [],
};

/**
 * Admin home — KPIs and day lists come ONLY from GET /dashboard/admin (live DB).
 * No browser storage cache, no list.length over incomplete fetches, no mock fallbacks.
 */
export default function AdminDashboard({ user }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSummary(null);
    api.dashboard
      .adminSummary()
      .then((payload) => {
        if (cancelled) return;
        setSummary(payload && typeof payload === "object" ? payload : EMPTY_SUMMARY);
      })
      .catch((err) => {
        if (cancelled) return;
        setSummary(null);
        setError(userFacingError(err) || "Не удалось загрузить дашборд");
        toast({
          title: "Ошибка загрузки дашборда",
          description: userFacingError(err),
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="p-6 space-y-4" data-testid="admin-dashboard-loading">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-3" data-testid="admin-dashboard-error">
        <p className="font-medium text-foreground">Не удалось загрузить статистику</p>
        <p className="text-sm text-muted-foreground">{error || "Нет данных"}</p>
      </div>
    );
  }

  const counts = summary.counts || EMPTY_SUMMARY.counts;
  const todayLessons = Array.isArray(summary.lessons_today) ? summary.lessons_today : [];
  const tomorrowLessons = Array.isArray(summary.lessons_tomorrow) ? summary.lessons_tomorrow : [];
  const upcomingBirthdays = Array.isArray(summary.upcoming_birthdays)
    ? summary.upcoming_birthdays
    : [];
  const lowBalance = Number(counts.low_balance_students) || 0;

  const todayLabel = summary.today
    ? format(parseISO(summary.today), "d MMMM", { locale: ru })
    : "";
  const tomorrowLabel = summary.tomorrow
    ? format(parseISO(summary.tomorrow), "d MMMM", { locale: ru })
    : "";

  const greetingName = getGreetingName(user);
  const heading = greetingName
    ? `${getGreeting()}, ${greetingName}`
    : `${getGreeting()}!`;

  return (
    <div
      className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto w-full min-w-0"
      data-testid="admin-dashboard"
      data-dashboard-ssot="api"
    >
      <div>
        <h2 className="text-xl font-bold text-foreground">{heading}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Вот что происходит сегодня</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div data-testid="admin-stat-lessons-today">
          <StatCard
            label="Уроков сегодня"
            value={counts.lessons_today}
            icon={CalendarDays}
            color="brand"
          />
        </div>
        <div data-testid="admin-stat-lessons-tomorrow">
          <StatCard
            label="Уроков завтра"
            value={counts.lessons_tomorrow}
            icon={Clock}
            color="muted"
          />
        </div>
        <div data-testid="admin-stat-students">
          <StatCard
            label="Всего учеников"
            value={counts.students}
            icon={GraduationCap}
            color="muted"
          />
        </div>
        <div data-testid="admin-stat-teachers">
          <StatCard
            label="Всего преподавателей"
            value={counts.teachers}
            icon={Users}
            color="emerald"
          />
        </div>
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
        <DashboardSection title="Уроки сегодня" subtitle={todayLabel}>
          <div className="space-y-0.5">
            {todayLessons.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Уроков сегодня нет</p>
            ) : (
              todayLessons.map((l) => (
                <LessonRow key={l.id} lesson={l} />
              ))
            )}
          </div>
        </DashboardSection>

        <DashboardSection title="Уроки завтра" subtitle={tomorrowLabel}>
          <div className="space-y-0.5">
            {tomorrowLessons.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Уроков завтра нет</p>
            ) : (
              tomorrowLessons.map((l) => (
                <LessonRow key={l.id} lesson={l} />
              ))
            )}
          </div>
        </DashboardSection>
      </div>

      {upcomingBirthdays.length > 0 && (
        <DashboardSection title="Дни рождения (ближайшие 30 дней)" icon={Cake} iconClass="text-pink-400">
          <div className="divide-y divide-border">
            {upcomingBirthdays.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-2 py-3">
                <div className="w-7 h-7 rounded-full bg-pink-100 dark:bg-pink-950/50 flex items-center justify-center">
                  <span className="text-xs font-semibold text-pink-600 dark:text-pink-400">
                    {(s.name || "?")[0]}
                  </span>
                </div>
                <span className="text-sm text-foreground flex-1">{s.name}</span>
                <div className="text-right">
                  <p className="text-xs font-semibold text-foreground">
                    {format(parseISO(s.birthday_date || s.birthdayDate), "d MMMM")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {(s.days_until ?? s.daysUntil) === 0
                      ? "🎂 Сегодня!"
                      : `через ${s.days_until ?? s.daysUntil} дн.`}
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
