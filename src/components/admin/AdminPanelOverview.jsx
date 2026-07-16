import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Users,
  GraduationCap,
  CreditCard,
  Calendar,
  Download,
  Layers,
  Award,
  DollarSign,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import StatCard from "@/components/dashboard/StatCard";
import { Card } from "@/components/ui/card";

const QUICK_ACTIONS = [
  { label: "Расписание", page: "Schedule", icon: Calendar, color: "indigo" },
  { label: "Пользователи", page: "UserManagement", icon: Users, color: "sky" },
  { label: "Платежи", page: "Payments", icon: CreditCard, color: "emerald" },
  { label: "Группы", page: "Groups", icon: Users, color: "violet" },
  { label: "Сертификаты", page: "Certificates", icon: Award, color: "amber" },
];

export default function AdminPanelOverview({ onOpenExport, onOpenSalary }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayLessons: 0,
    activeStudents: 0,
    activeTeachers: 0,
    lowBalance: 0,
  });

  useEffect(() => {
    Promise.all([api.lessons.list("-date", 100), api.students.list(), api.teachers.list()])
      .then(([lessons, students, teachers]) => {
        const today = new Date().toISOString().slice(0, 10);
        const todayLessons = lessons.filter(
          (l) => l.date === today && l.status !== "cancelled",
        ).length;
        const activeStudents = students.filter((s) => s.status !== "inactive");
        const lowBalance = activeStudents.filter((s) => (s.lesson_balance ?? 0) <= 2).length;
        setStats({
          todayLessons,
          activeStudents: activeStudents.length,
          activeTeachers: teachers.filter((t) => t.status !== "inactive").length,
          lowBalance,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-foreground">Обзор CRM</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ключевые показатели и быстрый переход к разделам
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Уроков сегодня" value={stats.todayLessons} icon={CalendarDays} color="indigo" />
        <StatCard label="Активных учеников" value={stats.activeStudents} icon={GraduationCap} color="sky" />
        <StatCard label="Активных преподавателей" value={stats.activeTeachers} icon={Users} color="emerald" />
        <StatCard label="Низкий баланс" value={stats.lowBalance} icon={AlertCircle} color="amber" />
      </div>

      {stats.lowBalance > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            У {stats.lowBalance} учеников осталось 2 урока или меньше
          </p>
          <Link
            to={createPageUrl("UserManagement")}
            className="ml-auto text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1"
          >
            Открыть <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Быстрые действия</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.page}
                to={createPageUrl(action.page)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium text-foreground"
              >
                <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
                {action.label}
              </Link>
            );
          })}
          {onOpenSalary && (
            <button
              type="button"
              onClick={onOpenSalary}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium text-foreground text-left"
            >
              <DollarSign className="w-4 h-4 text-indigo-500 shrink-0" />
              Зарплата
            </button>
          )}
          {onOpenExport && (
            <button
              type="button"
              onClick={onOpenExport}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium text-foreground text-left"
            >
              <Download className="w-4 h-4 text-indigo-500 shrink-0" />
              Экспорт данных
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
