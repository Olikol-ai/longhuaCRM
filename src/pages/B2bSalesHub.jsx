import { useEffect, useState } from 'react';
import { api } from '@/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageLoading,
} from '@/design-system';
import { Building2, Plus, Trash2, Wallet, Users } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import B2bSalesDiaryPanel from '@/components/b2b/B2bSalesDiaryPanel';
import { userFacingError } from '@/lib/userFacingError';

const TABS = [
  { id: 'organizations', label: 'Организации' },
  { id: 'diary', label: 'Дневник менеджеров' },
  { id: 'receipts', label: 'Поступления' },
  { id: 'commissions', label: 'Комиссии' },
];

function formatMoney(value, currency = 'BYN') {
  const n = Number.parseFloat(String(value ?? 0));
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export default function B2bSalesHub() {
  const [tab, setTab] = useState('organizations');
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [accruals, setAccruals] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [form, setForm] = useState({ name: '', unp: '', salesManagerUserId: '' });
  const [receiptForm, setReceiptForm] = useState({
    organizationId: '',
    amount: '',
    groupId: '',
    purpose: '',
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [orgs, rcpts, accr, dash] = await Promise.all([
        api.b2b.organizations.list(),
        api.b2b.receipts.list(),
        api.b2b.commissions.accruals(),
        api.b2b.dashboard(),
      ]);
      setOrganizations(Array.isArray(orgs) ? orgs : []);
      setReceipts(Array.isArray(rcpts) ? rcpts : []);
      setAccruals(Array.isArray(accr) ? accr : []);
      setDashboard(dash);
    } catch (err) {
      toast({ title: 'Ошибка загрузки', description: userFacingError(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createOrganization = async (e) => {
    e.preventDefault();
    try {
      await api.b2b.organizations.create({
        name: form.name,
        unp: form.unp || undefined,
        salesManagerUserId: form.salesManagerUserId || undefined,
      });
      setForm({ name: '', unp: '', salesManagerUserId: '' });
      toast({ title: 'Организация создана' });
      await load();
    } catch (err) {
      toast({ title: 'Не удалось создать', description: userFacingError(err), variant: 'destructive' });
    }
  };

  const confirmDeleteOrganization = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await api.b2b.organizations.remove(deleteTarget.id);
      setDeleteTarget(null);
      toast({ title: 'Организация удалена' });
      await load();
    } catch (err) {
      toast({
        title: 'Не удалось удалить организацию',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const createReceipt = async (e) => {
    e.preventDefault();
    try {
      await api.b2b.receipts.create({
        organizationId: receiptForm.organizationId,
        amount: receiptForm.amount,
        groupId: receiptForm.groupId || undefined,
        purpose: receiptForm.purpose || undefined,
        status: 'received',
      });
      setReceiptForm({ organizationId: '', amount: '', groupId: '', purpose: '' });
      toast({ title: 'Поступление зарегистрировано' });
      await load();
    } catch (err) {
      toast({
        title: 'Не удалось создать поступление',
        description: userFacingError(err),
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <PageLoading label="Загрузка B2B продаж" />;
  }

  const summary = dashboard?.summary ?? {};

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Продажи / Контрагенты</h1>
        <p className="text-sm text-muted-foreground mt-1">B2B-обучение: организации, поступления, комиссии</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Организации</p><p className="text-xl font-bold">{summary.organizations_count ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Группы</p><p className="text-xl font-bold">{summary.groups_count ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Поступления</p><p className="text-lg font-bold">{formatMoney(summary.receipts_total)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Комиссии</p><p className="text-lg font-bold">{formatMoney(summary.commission_total)}</p></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-touch px-4 py-2 rounded-lg text-sm font-medium border ${
              tab === t.id ? 'bg-foreground text-background border-transparent' : 'bg-card text-muted-foreground border-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'organizations' && (
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Новая организация</h2>
            <form onSubmit={createOrganization} className="grid sm:grid-cols-2 gap-3">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Наименование" required />
              <Input value={form.unp} onChange={(e) => setForm((f) => ({ ...f, unp: e.target.value }))} placeholder="УНП" />
              <Input value={form.salesManagerUserId} onChange={(e) => setForm((f) => ({ ...f, salesManagerUserId: e.target.value }))} placeholder="ID менеджера (UUID)" className="sm:col-span-2" />
              <Button type="submit" className="sm:col-span-2 w-fit">Создать</Button>
            </form>
          </Card>

          {organizations.length === 0 ? (
            <EmptyState preset="generic" title="Нет организаций" icon={Building2} />
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <Card key={org.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{org.name}</p>
                      <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                        {org.unp && <Badge variant="muted">УНП {org.unp}</Badge>}
                        {org.sales_manager_user_id && (
                          <Badge variant="muted">Менеджер: {org.sales_manager_user_id.slice(0, 8)}…</Badge>
                        )}
                        <Badge variant="muted">{org.status}</Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      intent="outline"
                      size="sm"
                      className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(org)}
                      data-testid={`b2b-org-delete-${org.id}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Удалить
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'diary' && (
        <B2bSalesDiaryPanel organizations={organizations} />
      )}

      {tab === 'receipts' && (
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Wallet className="w-4 h-4" /> Новое поступление</h2>
            <form onSubmit={createReceipt} className="grid sm:grid-cols-2 gap-3">
              <Input value={receiptForm.organizationId} onChange={(e) => setReceiptForm((f) => ({ ...f, organizationId: e.target.value }))} placeholder="ID организации" required />
              <Input value={receiptForm.amount} onChange={(e) => setReceiptForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Сумма" required />
              <Input value={receiptForm.groupId} onChange={(e) => setReceiptForm((f) => ({ ...f, groupId: e.target.value }))} placeholder="ID группы (необяз.)" />
              <Input value={receiptForm.purpose} onChange={(e) => setReceiptForm((f) => ({ ...f, purpose: e.target.value }))} placeholder="Назначение" />
              <Button type="submit" className="sm:col-span-2 w-fit">Зарегистрировать</Button>
            </form>
          </Card>
          <div className="space-y-2">
            {receipts.map((r) => (
              <Card key={r.id} className="p-3 text-sm flex flex-wrap justify-between gap-2">
                <span>{formatMoney(r.amount, r.currency)}</span>
                <span className="text-muted-foreground">{r.received_at ? new Date(r.received_at).toLocaleDateString('ru-RU') : '—'}</span>
                <Badge variant="muted">{r.status}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'commissions' && (
        <div className="space-y-2">
          {accruals.length === 0 ? (
            <EmptyState preset="generic" title="Начислений пока нет" icon={Users} />
          ) : (
            accruals.map((a) => (
              <Card key={a.id} className="p-3 text-sm flex flex-wrap justify-between gap-2">
                <span>{formatMoney(a.amount)}</span>
                <Badge variant="muted">{a.status}</Badge>
              </Card>
            ))
          )}
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-[min(100%,24rem)] mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить организацию?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name
                ? `«${deleteTarget.name}» будет удалена из B2B вместе со связанными поступлениями и дневником.`
                : 'Организация будет удалена из B2B.'}
              {' '}
              Ученики, группы и уроки CRM не удаляются.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel disabled={deleting} className="w-full sm:w-auto">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteOrganization();
              }}
            >
              {deleting ? 'Удаление…' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
