import { useState, useEffect } from "react";
import { api } from '@/api';
import { Download, Users, CreditCard, BookOpen, TrendingUp, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { resolvePaymentStudentLabel, resolveLessonStudentLabel } from "@/lib/studentLabels";
import { resolveLessonTeacherLabel } from "@/lib/teacherLabels";
import { parseMoneyAmount } from "@/lib/money";

function exportCSV(filename, rows) {
  const blob = new Blob([rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8;\uFEFF" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function ExportData() {
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    Promise.all([
      api.students.list(),
      api.payments.list("-payment_date", 1000),
      api.lessons.list("-date", 2000),
      api.teachers.list(),
    ]).then(([s, p, l, t]) => {
      setStudents(s); setPayments(p); setLessons(l); setTeachers(t);
      setLoading(false);
    });
  }, []);

  const doExport = async (type) => {
    setExporting(type);
    const now = format(new Date(), "yyyy-MM-dd");
    switch (type) {
      case "students":
        exportCSV(`students_${now}.csv`, [
          ["ID", "ФИО", "Email", "Телефон", "Telegram ID", "Статус", "Баланс уроков", "Преподаватель", "Дата начала", "Заметки"],
          ...students.map(s => {
            const teacher = teachers.find(t => t.id === s.assigned_teacher);
            return [s.id, s.name, s.email || "", s.phone || "", s.telegram_id || "",
              s.status, s.lesson_balance || 0, teacher?.name || "", s.start_date || "", s.notes || ""];
          })
        ]);
        break;
      case "payments":
        exportCSV(`payments_${now}.csv`, [
          ["ID", "Ученик", "Сумма (BYN)", "Уроков куплено", "Тип пакета", "Дата", "Комментарий"],
          ...payments.map(p => [p.id, resolvePaymentStudentLabel(p, students), p.amount, p.lessons_added, p.package_type || "", p.payment_date || "", p.comment || ""])
        ]);
        break;
      case "lessons":
        exportCSV(`lessons_${now}.csv`, [
          ["ID", "Дата", "Время", "Длительность (мин)", "Формат", "Статус", "Преподаватель", "Ученики", "Ссылка"],
          ...lessons.map(l => [l.id, l.date, l.start_time, l.duration || 60,
            l.lesson_format === "offline" ? "Очное" : "Дистанционное",
            l.status, l.teacher_name || resolveLessonTeacherLabel(l, teachers), resolveLessonStudentLabel(l, students),
            l.meeting_link || ""])
        ]);
        break;
      case "revenue":
        exportCSV(`revenue_${now}.csv`, [
          ["Месяц", "Выручка (BYN)", "Кол-во платежей", "Уроков куплено"],
          ...Object.entries(
            payments.reduce((acc, p) => {
              try {
                const month = format(parseISO(p.payment_date), "yyyy-MM");
                if (!acc[month]) acc[month] = { revenue: 0, count: 0, lessons: 0 };
                acc[month].revenue += parseMoneyAmount(p.amount);
                acc[month].count++;
                acc[month].lessons += (p.lessons_added || 0);
              } catch {}
              return acc;
            }, {})
          ).sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => [month, data.revenue, data.count, data.lessons])
        ]);
        break;
      case "salary":
        exportCSV(`salary_${now}.csv`, [
          ["Преподаватель", "Email", "Уроков (всего)", "Проведено", "Без предупреждения", "Часов", "Ставка (BYN/ч)", "Зарплата (BYN)"],
          ...teachers.map(t => {
            const tLessons = lessons.filter(l => l.teacher_id === t.id && (l.status === "completed" || l.status === "missed_no_notice"));
            const hours = tLessons.reduce((s, l) => s + (l.duration || 60) / 60, 0);
            return [t.name, t.email || "",
              tLessons.length,
              tLessons.filter(l => l.status === "completed").length,
              tLessons.filter(l => l.status === "missed_no_notice").length,
              hours.toFixed(1), t.hourly_rate || 0,
              Math.round(hours * (t.hourly_rate || 0))];
          })
        ]);
        break;
    }
    setExporting(null);
  };

  const EXPORTS = [
    { id: "students", label: "Ученики", desc: `${students.length} записей`, icon: Users, color: "sky" },
    { id: "payments", label: "Платежи", desc: `${payments.length} записей`, icon: CreditCard, color: "emerald" },
    { id: "lessons", label: "Занятия", desc: `${lessons.length} записей`, icon: BookOpen, color: "indigo" },
    { id: "revenue", label: "Выручка по месяцам", desc: "Сводный отчёт", icon: TrendingUp, color: "violet" },
    { id: "salary", label: "Зарплата (все месяцы)", desc: `${teachers.length} преподавателей`, icon: FileText, color: "amber" },
  ];

  const colorMap = {
    sky: "bg-sky-50 dark:bg-sky-950/30 border-sky-100 dark:border-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-950/50",
    emerald: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/50",
    indigo: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-950/50",
    violet: "bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/50 hover:bg-violet-100 dark:hover:bg-violet-950/50",
    amber: "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-950/50",
  };
  const iconColor = {
    sky: "text-sky-600 dark:text-sky-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    indigo: "text-indigo-600 dark:text-indigo-400",
    violet: "text-violet-600 dark:text-violet-400",
    amber: "text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Экспорт данных</h2>
        <p className="text-sm text-muted-foreground">Скачайте данные в формате CSV для загрузки в 1С или Excel</p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
        Файлы экспортируются в формате CSV с кодировкой UTF-8 BOM — совместимо с Excel и 1С.
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {EXPORTS.map(item => (
            <div key={item.id} className={`flex items-center justify-between p-5 rounded-xl border transition-colors ${colorMap[item.color]}`}>
              <div className="flex items-center gap-3">
                <item.icon className={`w-5 h-5 ${iconColor[item.color]}`} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <button
                onClick={() => doExport(item.id)}
                disabled={exporting === item.id}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted disabled:opacity-50 transition-colors">
                <Download className="w-4 h-4" />
                {exporting === item.id ? "Подготовка..." : "Скачать CSV"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}