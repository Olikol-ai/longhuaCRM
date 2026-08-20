import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { api } from "@/api";
import PaymentModal from "@/components/payments/PaymentModal";
import PageHeader from "@/components/responsive/PageHeader";
import ResponsiveTable from "@/components/responsive/ResponsiveTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { formatBYN } from "@/lib/formatters";
import { sumPaymentAmounts } from "@/lib/money";
import { resolvePaymentStudentLabel } from "@/lib/studentLabels";
import { userFacingError } from "@/lib/userFacingError";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { id: "all", label: "Все" },
  { id: "pending", label: "Ожидает" },
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

function statusBadgeVariant(status) {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "destructive";
    case "refunded":
      return "secondary";
    default:
      return "outline";
  }
}

function paymentDateLabel(payment) {
  const raw = payment.paid_at || payment.payment_date || payment.created_at;
  if (!raw) return "—";
  try {
    const d =
      typeof raw === "string" && raw.includes("T")
        ? parseISO(raw)
        : parseISO(String(raw).slice(0, 10));
    return format(d, "dd.MM.yyyy");
  } catch {
    return String(raw).slice(0, 10);
  }
}

export default function Payments() {
  const { user } = useAuth();
  const canDeletePayments = user?.role === "admin";
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
      const [p, s, items, c] = await Promise.all([
        api.payments.list("-payment_date", 200),
        api.students.paymentOptions(),
        api.payments.shopItems.list("sort_order"),
        api.teacherStudentContacts
          .listMine({ ownerType: "teacher" })
          .catch(() => []),
      ]);
      setPayments(Array.isArray(p) ? p : []);
      setStudents(Array.isArray(s) ? s : []);
      setShopItems(Array.isArray(items) ? items : []);
      setContacts(Array.isArray(c) ? c : []);
    } catch (err) {
      const message = userFacingError(err) || "Не удалось загрузить платежи";
      setError(message);
      toast({
        title: "Не удалось загрузить платежи",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.role]);

  const studentLabel = (payment) => resolvePaymentStudentLabel(payment, students);

  const serviceLabel = (payment) => {
    const item = payment.shop_item_id ? shopItemById.get(payment.shop_item_id) : null;
    if (item) return item.name || item.label || "—";
    if (payment.lessons_added > 0) return `+${payment.lessons_added} уроков`;
    return "—";
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editingPayment) {
        await api.payments.update(editingPayment.id, data);
        toast({ title: "Платёж обновлён" });
      } else {
        await api.payments.create(data);
        toast({ title: "Платёж сохранён" });
      }
      setShowModal(false);
      setEditingPayment(null);
      await load();
    } catch (err) {
      toast({
        title: editingPayment
          ? "Не удалось обновить платёж"
          : "Не удалось сохранить платёж",
        description: userFacingError(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.payments.delete(deleteTarget.id);
      toast({ title: "Платёж удалён" });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast({
        title: "Не удалось удалить платёж",
        description: userFacingError(err),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
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
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      studentLabel(p),
      serviceLabel(p),
      p.order_number,
      PROVIDER_LABEL[p.provider] || p.provider,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const openCreate = () => {
    setEditingPayment(null);
    setShowModal(true);
  };

  const openEdit = (payment) => {
    setEditingPayment(payment);
    setShowModal(true);
  };

  return (
    <div
      className="p-3 sm:p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden"
      data-testid="payments-page"
    >
      <PageHeader
        title="Платежи"
        description={
          loading
            ? "Загрузка реестра…"
            : `${payments.length} ${payments.length === 1 ? "запись" : "записей"} в реестре`
        }
        actions={
          <Button
            type="button"
            className="gap-2 w-full sm:w-auto min-h-11"
            onClick={openCreate}
            data-testid="payment-add"
          >
            <Plus className="h-4 w-4" />
            Добавить платёж
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive" data-testid="payments-error">
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void load()}
            >
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        <Card className="shadow-sm min-w-0">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground break-words">
              {formatBYN(totalRevenue)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Общая выручка (оплачено)</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm min-w-0">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft">
              <TrendingUp className="h-4 w-4 text-brand" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground break-words">
              {formatBYN(monthRevenue)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">В этом месяце</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm min-w-0 sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft">
              <CreditCard className="h-4 w-4 text-brand" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {thisMonth.length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Платежей за месяц</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center min-w-0">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск: ученик, услуга, заказ…"
            className="h-11 pl-9 md:h-10"
            data-testid="payments-search"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по статусу">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={statusFilter === f.id ? "default" : "outline"}
              className="min-h-10"
              onClick={() => setStatusFilter(f.id)}
              data-testid={`payments-filter-${f.id}`}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16" data-testid="payments-loading">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : (
        <ResponsiveTable
          rows={filtered}
          empty={
            <div className="space-y-2 py-2">
              <CreditCard className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">
                {payments.length === 0 ? "Платежей пока нет" : "Ничего не найдено"}
              </p>
              <p className="text-sm text-muted-foreground">
                {payments.length === 0
                  ? "Добавьте первый платёж — баланс ученика увеличится на купленные уроки."
                  : "Измените поиск или фильтр статуса."}
              </p>
              {payments.length === 0 ? (
                <Button type="button" className="mt-2 gap-2" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Добавить платёж
                </Button>
              ) : null}
            </div>
          }
          cardTitle={(payment) => (
            <span className="truncate" title={studentLabel(payment)}>
              {studentLabel(payment)}
            </span>
          )}
          columns={[
            {
              id: "student",
              header: "Ученик",
              hideOnCard: true,
              cell: (payment) => (
                <span
                  className="font-medium text-foreground truncate max-w-[12rem] inline-block align-bottom"
                  title={studentLabel(payment)}
                >
                  {studentLabel(payment)}
                </span>
              ),
            },
            {
              id: "service",
              header: "Курс / услуга",
              cell: (payment) => (
                <span className="truncate max-w-[10rem] inline-block align-bottom" title={serviceLabel(payment)}>
                  {serviceLabel(payment)}
                </span>
              ),
            },
            {
              id: "amount",
              header: "Сумма",
              cell: (payment) => (
                <span className="font-semibold tabular-nums whitespace-nowrap text-emerald-700 dark:text-emerald-400">
                  {formatBYN(payment.amount)}
                </span>
              ),
            },
            {
              id: "status",
              header: "Статус",
              cell: (payment) => {
                const status = payment.status || "paid";
                return (
                  <Badge variant={statusBadgeVariant(status)} className="font-medium">
                    {STATUS_LABEL[status] || status}
                  </Badge>
                );
              },
            },
            {
              id: "date",
              header: "Дата",
              cell: (payment) => (
                <span className="tabular-nums text-muted-foreground">
                  {paymentDateLabel(payment)}
                </span>
              ),
            },
            {
              id: "order",
              header: "№ заказа",
              cell: (payment) => (
                <span className="font-mono text-xs text-muted-foreground">
                  {payment.order_number || "—"}
                </span>
              ),
            },
            {
              id: "provider",
              header: "Провайдер",
              cell: (payment) =>
                PROVIDER_LABEL[payment.provider] || payment.provider || "—",
            },
          ]}
          cardActions={(payment) => (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 min-h-10"
                onClick={() => openEdit(payment)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Изменить
              </Button>
              {canDeletePayments ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="gap-1.5 min-h-10"
                  onClick={() => setDeleteTarget(payment)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить
                </Button>
              ) : null}
            </>
          )}
        />
      )}

      {showModal ? (
        <PaymentModal
          key={editingPayment?.id || "create"}
          open={showModal}
          students={students}
          contacts={contacts}
          initialData={editingPayment}
          saving={saving}
          onSave={handleSave}
          onClose={() => {
            if (saving) return;
            setShowModal(false);
            setEditingPayment(null);
          }}
        />
      ) : null}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить платёж?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {deleteTarget
                  ? `${studentLabel(deleteTarget)} · ${formatBYN(deleteTarget.amount)}`
                  : null}
              </span>
              <span className="block">
                Баланс ученика будет уменьшен на{" "}
                <strong>{deleteTarget?.lessons_added ?? 0}</strong> уроков. Это действие
                нельзя отменить.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Удаление…
                </>
              ) : (
                "Удалить"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
