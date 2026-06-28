import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, CreditCard, TrendingUp, Search, Pencil, Trash2 } from "lucide-react";
import PaymentModal from "../components/payments/PaymentModal";
import { format, parseISO } from "date-fns";

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [p, s] = await Promise.all([
      base44.entities.Payment.list("-payment_date", 200),
      base44.entities.Student.list(),
    ]);
    setPayments(p);
    setStudents(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    if (editingPayment) {
      await base44.entities.Payment.update(editingPayment.id, data);
      setEditingPayment(null);
    } else {
      await base44.entities.Payment.create(data);
    }
    setShowModal(false);
    load();
  };

  const handleDelete = async (payment) => {
    if (!window.confirm(`Удалить платёж ${payment.student_name} на ${payment.amount} BYN? Баланс ученика будет уменьшен на ${payment.lessons_added} уроков.`)) return;
    await base44.entities.Payment.delete(payment.id);
    load();
  };

  const totalRevenue = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const thisMonth = payments.filter(p => {
    try {
      const d = parseISO(p.payment_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch { return false; }
  });
  const monthRevenue = thisMonth.reduce((s, p) => s + (p.amount || 0), 0);

  const filtered = payments.filter(p =>
    p.student_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Платежи</h2>
          <p className="text-sm text-slate-400">{payments.length} записей всего</p>
        </div>
        <button
          onClick={() => { setEditingPayment(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Добавить платёж
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-100 rounded-xl p-5">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center mb-3">
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{totalRevenue.toLocaleString()} BYN</p>
          <p className="text-xs text-slate-400 mt-0.5">Общая выручка</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-5">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{monthRevenue.toLocaleString()} BYN</p>
          <p className="text-xs text-slate-400 mt-0.5">В этом месяце</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-5">
          <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center mb-3">
            <CreditCard className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{thisMonth.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Платежей за месяц</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по ученику..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-50 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Платежи не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">Ученик</th>
                  <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">Сумма (BYN)</th>
                  <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">Уроков добавлено</th>
                  <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">Дата</th>
                  <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3 hidden md:table-cell">Комментарий</th>
                  <th className="px-4 py-3"></th>
                  </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                  {filtered.map(payment => (
                  <tr key={payment.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-xs font-semibold text-indigo-600">
                            {(payment.student_name || "?")[0]}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-slate-700">{payment.student_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-emerald-600">{payment.amount} BYN</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                        +{payment.lessons_added} уроков
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">{payment.payment_date}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-slate-400">{payment.comment || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingPayment(payment); setShowModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(payment)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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