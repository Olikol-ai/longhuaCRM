import { Fragment, useState, useEffect, useCallback } from "react";
import { api } from "@/api";
import { format, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Download,
  GraduationCap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/formatters";

const fieldCls =
  "px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20";

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return {
    value: format(d, "yyyy-MM"),
    label: format(d, "LLLL yyyy", { locale: ru }),
  };
});

function exportCSV(filename, rows) {
  const blob = new Blob(
    [rows.map((r) => r.map((c) => `"${String(c)}"`).join(",")).join("\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function statusLabel(status) {
  return status === "paid" ? "Выплачено" : "Не выплачено";
}

/**
 * Admin «Зарплата» — только месячный summary.
 * Источник: GET /teacher-payments/summary?month=YYYY-MM
 * Без поурочного реестра TeacherPayment и без client-side агрегации из уроков.
 */
export default function Salary() {
  const [rows, setRows] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [loading, setLoading] = useState(true);
  const [expandedTeacherId, setExpandedTeacherId] = useState(null);
  const [detailsByTeacher, setDetailsByTeacher] = useState({});
  const [detailsLoadingId, setDetailsLoadingId] = useState(null);
  const [payingTeacherId, setPayingTeacherId] = useState(null);

  const load = useCallback(async (month) => {
    setLoading(true);
    try {
      const data = await api.teacherPayments.summary(month);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({
        title: "Не удалось загрузить зарплату",
        description: err?.message,
        variant: "destructive",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setExpandedTeacherId(null);
    setDetailsByTeacher({});
    load(selectedMonth);
  }, [selectedMonth, load]);

  const monthLabel =
    MONTHS.find((m) => m.value === selectedMonth)?.label || selectedMonth;
  const totalSalary = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalLessons = rows.reduce(
    (sum, row) => sum + Number(row.lessons_count ?? row.lessonsCount ?? 0),
    0,
  );

  const handleExport = () => {
    exportCSV(`salary_${selectedMonth}.csv`, [
      ["Преподаватель", "Количество занятий", "Часов", "Сумма (BYN)", "Статус выплаты"],
      ...rows.map((row) => [
        row.teacher_name ?? row.teacherName ?? "",
        row.lessons_count ?? row.lessonsCount ?? 0,
        row.total_hours ?? row.totalHours ?? 0,
        row.amount ?? 0,
        statusLabel(row.payment_status ?? row.paymentStatus),
      ]),
      ["ИТОГО", totalLessons, "", totalSalary, ""],
    ]);
  };

  const toggleDetails = async (teacherId) => {
    if (expandedTeacherId === teacherId) {
      setExpandedTeacherId(null);
      return;
    }
    setExpandedTeacherId(teacherId);
    if (detailsByTeacher[teacherId]) return;

    setDetailsLoadingId(teacherId);
    try {
      const details = await api.teacherPayments.summaryDetails(
        selectedMonth,
        teacherId,
      );
      setDetailsByTeacher((prev) => ({
        ...prev,
        [teacherId]: Array.isArray(details) ? details : [],
      }));
    } catch (err) {
      toast({
        title: "Не удалось загрузить занятия",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setDetailsLoadingId(null);
    }
  };

  const payMonth = async (row) => {
    const teacherId = row.teacher_id ?? row.teacherId;
    setPayingTeacherId(teacherId);
    try {
      await api.teacherPayments.markMonthPaid({
        teacherId,
        month: selectedMonth,
        amount: Number(row.amount || 0),
      });
      toast({ title: "Выплата за месяц отмечена" });
      await load(selectedMonth);
    } catch (err) {
      toast({
        title: "Не удалось создать выплату",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setPayingTeacherId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 w-full min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Зарплата преподавателей</h2>
          <p className="text-sm text-muted-foreground">
            Месяц: {monthLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={fieldCls}
            aria-label="Месяц"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted"
          >
            <Download className="w-4 h-4" /> Скачать CSV
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary to-brand-hover rounded-xl p-5 text-primary-foreground">
        <p className="text-primary-foreground/80 text-sm mb-1">Итого к выплате</p>
        <p className="text-3xl font-bold">{formatCurrency(totalSalary)}</p>
        <p className="text-primary-foreground/80 text-xs mt-1">
          {rows.length} преподавателей · {totalLessons} занятий · {monthLabel}
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="text-center py-12">
          <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Нет завершённых занятий за {monthLabel}
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl bg-card">
          <table className="w-full text-sm min-w-[40rem]">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Преподаватель</th>
                <th className="px-4 py-3 font-medium">Количество занятий</th>
                <th className="px-4 py-3 font-medium">Часы</th>
                <th className="px-4 py-3 font-medium">Сумма</th>
                <th className="px-4 py-3 font-medium">Статус выплаты</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const teacherId = row.teacher_id ?? row.teacherId;
                const paymentStatus = row.payment_status ?? row.paymentStatus;
                const lessonsCount = row.lessons_count ?? row.lessonsCount ?? 0;
                const totalHours = Number(row.total_hours ?? row.totalHours ?? 0);
                const isExpanded = expandedTeacherId === teacherId;
                const details = detailsByTeacher[teacherId] || [];

                return (
                  <Fragment key={teacherId}>
                    <tr className="border-b border-border align-top">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {row.teacher_name ?? row.teacherName}
                      </td>
                      <td className="px-4 py-3">{lessonsCount}</td>
                      <td className="px-4 py-3">{totalHours.toFixed(1)}</td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCurrency(row.amount || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            paymentStatus === "paid"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-700 dark:text-amber-400"
                          }
                        >
                          {statusLabel(paymentStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => toggleDetails(teacherId)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted"
                          >
                            Подробнее
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                          {paymentStatus !== "paid" ? (
                            <button
                              type="button"
                              disabled={payingTeacherId === teacherId}
                              onClick={() => payMonth(row)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                            >
                              {payingTeacherId === teacherId ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                              Выплатить
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b border-border bg-muted/40">
                        <td colSpan={6} className="px-4 py-3">
                          {detailsLoadingId === teacherId ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" /> Загрузка занятий…
                            </p>
                          ) : details.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Нет занятий</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {details.map((lesson) => (
                                <li
                                  key={lesson.lesson_id ?? lesson.lessonId}
                                  className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1"
                                >
                                  <span>
                                    {lesson.date}{" "}
                                    {String(lesson.start_time ?? lesson.startTime ?? "").slice(0, 5)}
                                  </span>
                                  <span>{lesson.duration || 60} мин</span>
                                  <span>{formatCurrency(lesson.amount || 0)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-muted rounded-xl p-4 text-xs text-muted-foreground">
        <p className="font-medium mb-1">Примечание</p>
        <p>
          В отчёт входят только завершённые занятия активных преподавателей за выбранный месяц.
        </p>
        <p>Формула: ставка (BYN/час) × длительность занятия (часы).</p>
        <p>Выплата создаётся один раз на пару «преподаватель + месяц».</p>
      </div>
    </div>
  );
}
