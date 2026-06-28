import { useState, useEffect } from "react";
import { api } from '@/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parseISO, format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { TrendingUp, Users, BookOpen, Download, GraduationCap, CreditCard } from "lucide-react";

function StatBox({ label, value, color = "indigo" }) {
  const colors = {
    emerald: "bg-emerald-50 border-emerald-100",
    indigo: "bg-indigo-50 border-indigo-100",
    sky: "bg-sky-50 border-sky-100",
    violet: "bg-violet-50 border-violet-100",
    amber: "bg-amber-50 border-amber-100",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function exportCSV(filename, rows) {
  const blob = new Blob([rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function Analytics() {
  const [payments, setPayments] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.entities.Payment.list("-payment_date", 500),
      api.entities.Lesson.list("-date", 1000),
      api.entities.Student.list(),
      api.entities.Teacher.list(),
    ]).then(([p, l, s, t]) => {
      setPayments(p); setLessons(l); setStudents(s); setTeachers(t);
      setLoading(false);
    });
  }, []);

  const now = new Date();

  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(now, 5 - i);
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const revenue = payments
      .filter(p => { try { const d = parseISO(p.payment_date); return d >= start && d <= end; } catch { return false; } })
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    return { month: format(month, "MMM yy"), revenue };
  });

  const totalRevenue = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const monthPayments = payments.filter(p => {
    try { const d = parseISO(p.payment_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }
    catch { return false; }
  });
  const monthRevenue = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const activeStudents = students.filter(s => s.status === "active").length;
  const completedLessons = lessons.filter(l => l.status === "completed").length;
  const lowBalanceStudents = students.filter(s => (s.lesson_balance || 0) <= 1 && s.status === "active").length;

  const teacherStats = teachers.map(t => ({
    ...t,
    completed: lessons.filter(l => l.teacher_id === t.id && (l.status === "completed" || l.status === "missed_no_notice")).length,
    planned: lessons.filter(l => l.teacher_id === t.id && l.status === "planned").length,
    total: lessons.filter(l => l.teacher_id === t.id).length,
  })).sort((a, b) => b.total - a.total);
  const maxLessons = Math.max(...teacherStats.map(t => t.total), 1);

  const thisMonthLessons = lessons.filter(l => {
    try { const d = parseISO(l.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }
    catch { return false; }
  });

  const handleExport = () => {
    exportCSV(`analytics_${format(now, "yyyy-MM")}.csv`, [
      ["Метрика", "Значение"],
      ["Общая выручка (BYN)", totalRevenue],
      ["Выручка за месяц (BYN)", monthRevenue],
      ["Активных учеников", activeStudents],
      ["Уроков проведено всего", completedLessons],
      ["", ""],
      ["Выручка по месяцам", ""],
      ["Месяц", "Выручка (BYN)"],
      ...monthlyRevenue.map(m => [m.month, m.revenue]),
    ]);
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Аналитика</h2>
          <p className="text-sm text-slate-400">Показатели школы</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">
          <Download className="w-4 h-4" /> Экспорт CSV
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatBox label="Общая выручка" value={`${totalRevenue.toLocaleString()} BYN`} color="emerald" />
        <StatBox label="Выручка за месяц" value={`${monthRevenue.toLocaleString()} BYN`} color="indigo" />
        <StatBox label="Активных учеников" value={activeStudents} color="sky" />
        <StatBox label="Уроков проведено" value={completedLessons} color="violet" />
        <StatBox label="Мало уроков (≤1)" value={lowBalanceStudents} color="amber" />
      </div>

      {/* Monthly revenue chart */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Выручка по месяцам (BYN)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyRevenue} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <Tooltip formatter={(v) => [`${v.toLocaleString()} BYN`, "Выручка"]} />
            <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teacher workload */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Загрузка преподавателей</h3>
          <div className="space-y-3">
            {teacherStats.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Нет данных</p>
            ) : teacherStats.map(t => (
              <div key={t.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-indigo-600">{t.name?.[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{t.name}</p>
                    <span className="text-xs text-slate-400 ml-2">{t.completed} пров. · {t.planned} план.</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, (t.total / maxLessons) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* This month lesson breakdown */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Уроки за этот месяц</h3>
          <div className="space-y-1">
            {[
              { label: "Запланировано", status: "planned", color: "bg-sky-100 text-sky-700" },
              { label: "Проведено", status: "completed", color: "bg-emerald-100 text-emerald-700" },
              { label: "Отменено", status: "cancelled", color: "bg-red-100 text-red-700" },
              { label: "Перенесено", status: "rescheduled", color: "bg-amber-100 text-amber-700" },
              { label: "Пропущено (предупредил)", status: "missed", color: "bg-orange-100 text-orange-700" },
              { label: "Пропущено (не предупредил)", status: "missed_no_notice", color: "bg-red-100 text-red-700" },
            ].map(item => (
              <div key={item.status} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-600">{item.label}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${item.color}`}>
                  {thisMonthLessons.filter(l => l.status === item.status).length}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Students with low balance */}
      {students.filter(s => (s.lesson_balance || 0) <= 1 && s.status === "active").length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">⚠️ Ученики с малым балансом</h3>
          <div className="flex flex-wrap gap-2">
            {students.filter(s => (s.lesson_balance || 0) <= 1 && s.status === "active").map(s => (
              <span key={s.id} className="text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full">
                {s.name} — {s.lesson_balance || 0} ур.
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}