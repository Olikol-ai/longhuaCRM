import { useState, useEffect } from "react";
import { api } from '@/api';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { Download, GraduationCap, DollarSign, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { resolveTeacherPaymentLabel } from "@/lib/teacherLabels";
import { formatCurrency } from "@/lib/formatters";

const fieldCls = "px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

const MONTHS = Array.from({ length: 6 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, "yyyy-MM"), label: format(d, "LLLL yyyy", { locale: ru }) };
});

function exportCSV(filename, rows) {
  const blob = new Blob([rows.map(r => r.map(c => `"${String(c)}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function Salary() {
  const [lessons, setLessons] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [l, t, payments] = await Promise.all([
      api.lessons.list("-date", 1000),
      api.teachers.list(),
      api.teacherPayments.list(),
    ]);
    setLessons(l);
    setTeachers(t);
    setPaymentRows(Array.isArray(payments) ? payments : []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const [yearStr, monthStr] = selectedMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));

  const teacherSalaries = teachers.map(teacher => {
    const paidLessons = lessons.filter(l => {
      if (l.teacher_id !== teacher.id) return false;
      if (l.status !== "completed" && l.status !== "missed_no_notice") return false;
      try { const d = parseISO(l.date); return d >= start && d <= end; } catch { return false; }
    });
    const completedCount = paidLessons.filter(l => l.status === "completed").length;
    const missedNoNoticeCount = paidLessons.filter(l => l.status === "missed_no_notice").length;
    const totalHours = paidLessons.reduce((sum, l) => sum + (l.duration || 60) / 60, 0);
    const salary = Math.round(totalHours * (teacher.hourly_rate || 0));
    return { ...teacher, paidLessons, completedCount, missedNoNoticeCount, totalHours, salary };
  });

  const totalSalary = teacherSalaries.reduce((s, t) => s + t.salary, 0);
  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || selectedMonth;

  const handleExport = () => {
    exportCSV(`salary_${selectedMonth}.csv`, [
      ["Преподаватель", "Email", "Уроков проведено", "Без предупреждения", "Итого уроков", "Часов", "Ставка (BYN/ч)", "Зарплата (BYN)"],
      ...teacherSalaries.map(t => [
        t.name, t.email || "", t.completedCount, t.missedNoNoticeCount,
        t.paidLessons.length, t.totalHours.toFixed(1), t.hourly_rate || 0, t.salary
      ]),
      ["ИТОГО", "", teacherSalaries.reduce((s, t) => s + t.completedCount, 0),
        teacherSalaries.reduce((s, t) => s + t.missedNoNoticeCount, 0),
        teacherSalaries.reduce((s, t) => s + t.paidLessons.length, 0), "", "", totalSalary],
    ]);
  };

  const markPaid = async (row) => {
    try {
      await api.teacherPayments.update(row.id, { status: "paid" });
      toast({ title: "Выплата отмечена как оплаченная" });
      await load();
    } catch (err) {
      toast({ title: "Не удалось обновить выплату", description: err?.message, variant: "destructive" });
    }
  };

  const teacherName = (id) => resolveTeacherPaymentLabel(id, teachers);
  const lessonLabel = (id) => {
    const lesson = lessons.find((l) => l.id === id);
    return lesson ? `${lesson.date} ${lesson.start_time}` : id;
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 w-full min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Зарплата преподавателей</h2>
          <p className="text-sm text-muted-foreground">Расчёт за проведённые уроки и реестр начислений</p>
        </div>
        <div className="flex gap-2">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className={fieldCls}>
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-5 text-white">
        <p className="text-indigo-200 text-sm mb-1">Итого к выплате — {monthLabel}</p>
        <p className="text-3xl font-bold">{formatCurrency(totalSalary)}</p>
        <p className="text-indigo-200 text-xs mt-1">
          {teacherSalaries.filter(t => t.paidLessons.length > 0).length} преподавателей · {teacherSalaries.reduce((s, t) => s + t.paidLessons.length, 0)} уроков
        </p>
      </div>

      <div className="space-y-3">
        {teachers.length === 0 ? (
          <Card className="text-center py-12">
            <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Нет преподавателей</p>
          </Card>
        ) : teacherSalaries.map(teacher => (
          <Card key={teacher.id} className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{teacher.name?.[0]}</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{teacher.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Ставка: {teacher.hourly_rate ? formatCurrency(teacher.hourly_rate).replace(' BYN', ' BYN/час') : "не указана"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-foreground">{formatCurrency(teacher.salary)}</p>
                <p className="text-xs text-muted-foreground">
                  {teacher.paidLessons.length} уроков · {teacher.totalHours.toFixed(1)} ч
                </p>
              </div>
            </div>

            {teacher.paidLessons.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{teacher.completedCount}</p>
                  <p className="text-[11px] text-muted-foreground">Проведено</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{teacher.missedNoNoticeCount}</p>
                  <p className="text-[11px] text-muted-foreground">Без предупреждения</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{teacher.totalHours.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground">Часов</p>
                </div>
              </div>
            )}

            {teacher.paidLessons.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">Нет проведённых уроков за этот месяц</p>
            )}
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Начисления по урокам</h3>
          <p className="text-sm text-muted-foreground">Записи из реестра выплат после завершённых уроков</p>
        </div>
        {paymentRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Начислений пока нет</p>
        ) : (
          paymentRows.map((row) => (
            <div key={row.id} className="border rounded-xl p-4 bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 shrink-0" /> {formatCurrency(row.amount)}
                </p>
                <p className="text-xs text-muted-foreground break-words">
                  {teacherName(row.teacher_id)} · Урок {lessonLabel(row.lesson_id)} · {row.status}
                </p>
              </div>
              {row.status === "pending" && (
                <button
                  type="button"
                  onClick={() => markPaid(row)}
                  className="px-3 py-2.5 text-xs bg-emerald-600 text-white rounded-lg flex items-center justify-center gap-1 w-full sm:w-auto min-h-[40px] shrink-0"
                >
                  <CheckCircle2 className="w-3 h-3" /> Оплачено
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="bg-muted rounded-xl p-4 text-xs text-muted-foreground">
        <p className="font-medium mb-1">Примечание</p>
        <p>Зарплата начисляется за уроки со статусом «Проведено» и «Пропущено без предупреждения».</p>
        <p>Формула: ставка (BYN/час) × продолжительность урока (часы).</p>
      </div>
    </div>
  );
}
