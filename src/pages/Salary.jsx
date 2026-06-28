import { useState, useEffect } from "react";
import { api } from '@/api';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Download, GraduationCap, DollarSign } from "lucide-react";

const MONTHS = Array.from({ length: 6 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
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
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.entities.Lesson.list("-date", 1000),
      api.entities.Teacher.list(),
    ]).then(([l, t]) => {
      setLessons(l); setTeachers(t); setLoading(false);
    });
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
      ["Преподаватель", "Email", "Уроков проведено", "Без предупреждения", "Итого уроков", "Часов", "Ставка (₽/ч)", "Зарплата (₽)"],
      ...teacherSalaries.map(t => [
        t.name, t.email || "", t.completedCount, t.missedNoNoticeCount,
        t.paidLessons.length, t.totalHours.toFixed(1), t.hourly_rate || 0, t.salary
      ]),
      ["ИТОГО", "", teacherSalaries.reduce((s, t) => s + t.completedCount, 0),
        teacherSalaries.reduce((s, t) => s + t.missedNoNoticeCount, 0),
        teacherSalaries.reduce((s, t) => s + t.paidLessons.length, 0), "", "", totalSalary],
    ]);
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Зарплата преподавателей</h2>
          <p className="text-sm text-slate-400">Расчёт за проведённые уроки</p>
        </div>
        <div className="flex gap-2">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-5 text-white">
        <p className="text-indigo-200 text-sm mb-1">Итого к выплате — {monthLabel}</p>
        <p className="text-3xl font-bold">{totalSalary.toLocaleString()} BYN</p>
        <p className="text-indigo-200 text-xs mt-1">
          {teacherSalaries.filter(t => t.paidLessons.length > 0).length} преподавателей · {teacherSalaries.reduce((s, t) => s + t.paidLessons.length, 0)} уроков
        </p>
      </div>

      {/* Teacher cards */}
      <div className="space-y-3">
        {teachers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
            <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Нет преподавателей</p>
          </div>
        ) : teacherSalaries.map(teacher => (
          <div key={teacher.id} className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-600">{teacher.name?.[0]}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{teacher.name}</p>
                  <p className="text-xs text-slate-400">
                    Ставка: {teacher.hourly_rate ? `${teacher.hourly_rate} BYN/час` : "не указана"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-slate-800">{teacher.salary.toLocaleString()} BYN</p>
                <p className="text-xs text-slate-400">
                  {teacher.paidLessons.length} уроков · {teacher.totalHours.toFixed(1)} ч
                </p>
              </div>
            </div>

            {teacher.paidLessons.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-50 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-600">{teacher.completedCount}</p>
                  <p className="text-[11px] text-slate-400">Проведено</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-orange-600">{teacher.missedNoNoticeCount}</p>
                  <p className="text-[11px] text-slate-400">Без предупреждения</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-700">{teacher.totalHours.toFixed(1)}</p>
                  <p className="text-[11px] text-slate-400">Часов</p>
                </div>
              </div>
            )}

            {teacher.paidLessons.length === 0 && (
              <p className="text-xs text-slate-400 mt-3 text-center">Нет проведённых уроков за этот месяц</p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium mb-1">Примечание</p>
        <p>Зарплата начисляется за уроки со статусом «Проведено» и «Пропущено без предупреждения».</p>
        <p>Формула: ставка (BYN/час) × продолжительность урока (часы).</p>
      </div>
    </div>
  );
}