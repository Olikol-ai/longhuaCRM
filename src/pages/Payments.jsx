import { useState, useEffect } from "react";
import { api } from '@/api';
import { Plus, CreditCard, TrendingUp, Search, Pencil, Trash2 } from "lucide-react";
import PaymentModal from "../components/payments/PaymentModal";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { resolvePaymentStudentLabel } from "@/lib/studentLabels";
import { formatMoneyByn, sumPaymentAmounts } from "@/lib/money";

const inputCls = "w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400";

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [p, s] = await Promise.all([
        api.payments.list("-payment_date", 200),
        api.students.list(),
      ]);
      setPayments(p);
      setStudents(s);
    } catch (err) {
      setError(err.message || "Не удалось загрузить платежи");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    if (editingPayment) {
      await api.payments.update(editingPayment.id, data);
      setEditingPayment(null);
    } else {
      await api.payments.create(data);
    }
    setShowModal(false);
    load();
  };

  const studentLabel = (payment) => resolvePaymentStudentLabel(payment, students);

  const handleDelete = async (payment) => {
    if (!window.confirm(`Удалить платёж ${studentLabel(payment)} на ${payment.amount} BYN? Баланс ученика будет уменьшен на ${payment.lessons_added} уроков.`)) return;
    await api.payments.delete(payment.id);
    load();
  };

  const thisMonth = payments.filter((p) => {
    try {
      const d = parseISO(p.payment_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch {
      return false;
    }
  });
  const totalRevenue = sumPaymentAmounts(payments);
  const monthRevenue = sumPaymentAmounts(thisMonth);

  const filtered = payments.filter(p =>
    studentLabel(p).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm px-4 py-3">{error}</div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Платежи</h2>
          <p className="text-sm text-muted-foreground">{payments.length} записей всего</p>
        </div>
        <button
          onClick={() => { setEditingPayment(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Добавить платёж
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg flex items-center justify-center mb-3">
            <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatMoneyByn(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Общая выручка</p>
        </Card>
        <Card className="p-5">
          <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatMoneyByn(monthRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">В этом месяце</p>
        </Card>
        <Card className="p-5">
          <div className="w-8 h-8 bg-violet-50 dark:bg-violet-950/40 rounded-lg flex items-center justify-center mb-3">
            <CreditCard className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{thisMonth.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Платежей за месяц</p>
        </Card>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по ученику..."
          className={inputCls} />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Платежи не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Ученик</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Сумма (BYN)</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Уроков добавлено</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Дата</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden md:table-cell">Комментарий</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(payment => {
                  const label = studentLabel(payment);
                  return (
                  <tr key={payment.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center">
                          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {(label || "?")[0]}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{payment.amount} BYN</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full">
                        +{payment.lessons_added} уроков
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{payment.payment_date}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{payment.comment || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingPayment(payment); setShowModal(true); }}
                          className="p-1.5 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(payment)}
                          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <PaymentModal
          students={students}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingPayment(null); }}
          initialData={editingPayment}
        />
      )}
    </div>
  );
}
