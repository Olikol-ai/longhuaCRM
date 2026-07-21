import { useState, useEffect, useMemo } from "react";
import { api } from '@/api';
import { Plus, CreditCard, TrendingUp, Search, Pencil, Trash2 } from "lucide-react";
import PaymentModal from "../components/payments/PaymentModal";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { resolvePaymentStudentLabel } from "@/lib/studentLabels";
import { sumPaymentAmounts } from "@/lib/money";
import { formatCurrency } from "@/lib/formatters";

const inputCls = "w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40";

const STATUS_FILTERS = [
  { id: "all", label: "Все" },
  { id: "pending", label: "Ожидает оплаты" },
  { id: "paid", label: "Оплачено" },
  { id: "failed", label: "Ошибка" },
];

const STATUS_LABEL = {
  pending: "Ожидает",
  paid: "Оплачено",
  failed: "Ошибка",
  refunded: "Возврат",
};

const PROVIDER_LABEL = {
  alfa_bank: "AlfaBank",
  cash: "Наличные",
  manual: "Вручную",
};

function statusBadgeClass(status) {
  switch (status) {
    case "paid":
      return "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300";
    case "pending":
      return "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300";
    case "failed":
      return "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300";
    default:
      return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
  }
}

function paymentDateLabel(payment) {
  const raw = payment.paid_at || payment.payment_date || payment.created_at;
  if (!raw) return "—";
  try {
    const d = typeof raw === "string" && raw.includes("T") ? parseISO(raw) : parseISO(String(raw).slice(0, 10));
    return format(d, "dd.MM.yyyy");
  } catch {
    return String(raw).slice(0, 10);
  }
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");

  const shopItemById = useMemo(() => {
    const map = new Map();
    for (const item of shopItems) {
      map.set(item.id, item);
    }
    return map;
  }, [shopItems]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [p, s, items] = await Promise.all([
        api.payments.list("-payment_date", 200),
        api.students.list(),
        api.payments.shopItems.list("sort_order"),
      ]);
      setPayments(p);
      setStudents(s);
      setShopItems(items);
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

  const serviceLabel = (payment) => {
    const item = payment.shop_item_id ? shopItemById.get(payment.shop_item_id) : null;
    if (item) return item.name || item.label || "—";
    if (payment.lessons_added > 0) return `+${payment.lessons_added} уроков`;
    return "—";
  };

  const handleDelete = async (payment) => {
    if (!window.confirm(`Удалить платёж ${studentLabel(payment)} на ${formatCurrency(payment.amount)}? Баланс ученика будет уменьшен на ${payment.lessons_added} уроков.`)) return;
    await api.payments.delete(payment.id);
    load();
  };

  const paidPayments = payments.filter((p) => (p.status || "paid") === "paid");
  const thisMonth = paidPayments.filter((p) => {
    try {
      const d = parseISO(p.payment_date || p.paid_at || "");
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch {
      return false;
    }
  });
  const totalRevenue = sumPaymentAmounts(paidPayments);
  const monthRevenue = sumPaymentAmounts(thisMonth);

  const filtered = payments.filter((p) => {
    const status = p.status || "paid";
    if (statusFilter !== "all" && status !== statusFilter) return false;
    return studentLabel(p).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full min-w-0">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm px-4 py-3">{error}</div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Платежи</h2>
          <p className="text-sm text-muted-foreground">{payments.length} записей всего</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingPayment(null); setShowModal(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> Добавить платёж
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Card className="p-4 sm:p-5">
          <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg flex items-center justify-center mb-3">
            <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Общая выручка</p>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="w-8 h-8 bg-brand-soft dark:bg-brand-soft/40 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-brand dark:text-brand" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(monthRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">В этом месяце</p>
        </Card>
        <Card className="p-4 sm:p-5 sm:col-span-2 lg:col-span-1">
          <div className="w-8 h-8 bg-brand-soft dark:bg-brand-soft/40 rounded-lg flex items-center justify-center mb-3">
            <CreditCard className="w-4 h-4 text-brand dark:text-brand" />
          </div>
          <p className="text-2xl font-bold text-foreground">{thisMonth.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Платежей за месяц</p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative max-w-full sm:max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по ученику..."
            className={inputCls} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                statusFilter === f.id
                  ? "bg-primary text-primary-foreground border-brand"
                  : "bg-background text-muted-foreground border-border hover:border-brand/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
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
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Ученик</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Курс / услуга</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Сумма</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Статус</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden sm:table-cell">Дата</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden md:table-cell">№ заказа</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden lg:table-cell">Провайдер</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(payment => {
                  const label = studentLabel(payment);
                  const status = payment.status || "paid";
                  return (
                  <tr key={payment.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-muted dark:bg-brand-soft/50 flex items-center justify-center">
                          <span className="text-xs font-semibold text-brand dark:text-brand">
                            {(label || "?")[0]}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">{serviceLabel(payment)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(payment.amount)} {payment.currency || "BYN"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadgeClass(status)}`}>
                        {STATUS_LABEL[status] || status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">{paymentDateLabel(payment)}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-mono text-muted-foreground">{payment.order_number || "—"}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {PROVIDER_LABEL[payment.provider] || payment.provider || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingPayment(payment); setShowModal(true); }}
                          className="p-1.5 text-muted-foreground hover:text-brand hover:bg-brand-soft dark:hover:bg-brand-soft/50 rounded-lg transition-colors"
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
