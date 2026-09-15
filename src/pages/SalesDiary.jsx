import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  NumberInput,
  PageLoading,
  ResponsiveDialog,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  SearchField,
  Textarea,
} from '@/design-system';
import {
  SALES_DIARY_CONTACT_LABELS,
  SALES_DIARY_CONTACT_TYPES,
  SALES_DIARY_FILTERS,
  SALES_DIARY_STATUS_LABELS,
  SALES_DIARY_STATUSES,
  formatDiaryDate,
  formatDiaryDateTime,
} from '@/lib/sales-diary.constants';
import { Building2, CalendarClock, Phone, FileText, Handshake } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

function formatMoney(value, currency = 'BYN') {
  const n = Number.parseFloat(String(value ?? 0));
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function statusBadgeVariant(status) {
  if (status === 'contract_signed') return 'success';
  if (status === 'refused' || status === 'unreachable') return 'destructive';
  if (status === 'negotiations' || status === 'proposal_sent' || status === 'thinking') return 'warning';
  return 'muted';
}

function DiaryEntryCard({ entry, onOpen, onQuickContact }) {
  const dueClass = entry.is_overdue
    ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
    : entry.is_due_today
      ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20'
      : '';

  return (
    <Card className={`p-4 space-y-3 min-w-0 ${dueClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground break-words">{entry.organization_name}</p>
          {entry.organization_unp && (
            <p className="text-xs text-muted-foreground mt-0.5">УНП {entry.organization_unp}</p>
          )}
        </div>
        <Badge variant={statusBadgeVariant(entry.status)}>
          {SALES_DIARY_STATUS_LABELS[entry.status] ?? entry.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm text-muted-foreground">
        <p>Последний контакт: {formatDiaryDate(entry.last_contact_at)}</p>
        <p className={entry.is_overdue ? 'text-red-600 font-medium' : entry.is_due_today ? 'text-amber-700 font-medium' : ''}>
          Следующий контакт: {formatDiaryDate(entry.next_contact_at)}
        </p>
        <p>Потенциал: {entry.potential_students_count ?? 0} сотрудников</p>
        <p>По договору: {entry.deal_students_count ?? 0} · Факт: {entry.actual_students_count ?? 0}</p>
      </div>

      {entry.latest_note_preview && (
        <p className="text-sm italic text-muted-foreground line-clamp-2">
          «{entry.latest_note_preview}»
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" intent="outline" size="sm" onClick={() => onQuickContact(entry)}>
          <Phone className="w-4 h-4 mr-1" /> Контакт
        </Button>
        <Button type="button" intent="outline" size="sm" onClick={() => onOpen(entry)}>
          Подробнее
        </Button>
      </div>
    </Card>
  );
}

export default function SalesDiary() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [noteText, setNoteText] = useState('');
  const [contactForm, setContactForm] = useState({
    contactType: 'call',
    contactedAt: new Date().toISOString().slice(0, 16),
    result: '',
    nextContactAt: '',
    comment: '',
  });
  const [editForm, setEditForm] = useState({
    status: 'new',
    nextContactAt: '',
    potentialStudentsCount: 0,
  });
  const [dealForm, setDealForm] = useState({
    studentsCount: '',
    pricePerStudent: '',
    amount: '',
    currency: 'BYN',
    contractDate: '',
    startDate: '',
    comment: '',
    groupId: '',
  });
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, stats] = await Promise.all([
        api.b2b.diary.listEntries({ filter, search: search.trim() || undefined }),
        api.b2b.diary.summary(),
      ]);
      setEntries(Array.isArray(list) ? list : []);
      setSummary(stats);
    } catch (err) {
      toast({ title: 'Ошибка загрузки', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (entry) => {
    setSelected(entry);
    setDetailLoading(true);
    setDialog('detail');
    try {
      const full = await api.b2b.diary.getEntry(entry.id);
      setDetail(full);
      setEditForm({
        status: full.status,
        nextContactAt: full.next_contact_at ? full.next_contact_at.slice(0, 16) : '',
        potentialStudentsCount: full.potential_students_count ?? 0,
      });
    } catch (err) {
      toast({ title: 'Не удалось открыть карточку', description: err.message, variant: 'destructive' });
      setDialog(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveEntry = async () => {
    if (!selected) return;
    try {
      await api.b2b.diary.updateEntry(selected.id, {
        status: editForm.status,
        nextContactAt: editForm.nextContactAt ? new Date(editForm.nextContactAt).toISOString() : null,
        potentialStudentsCount: Number(editForm.potentialStudentsCount) || 0,
      });
      toast({ title: 'Сохранено' });
      setDialog(null);
      await load();
    } catch (err) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
    }
  };

  const submitNote = async () => {
    if (!selected || !noteText.trim()) return;
    try {
      await api.b2b.diary.addNote(selected.id, { note: noteText.trim() });
      setNoteText('');
      toast({ title: 'Заметка добавлена' });
      const full = await api.b2b.diary.getEntry(selected.id);
      setDetail(full);
      await load();
    } catch (err) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
    }
  };

  const submitContact = async (entryId = selected?.id) => {
    if (!entryId) return;
    try {
      await api.b2b.diary.addContact(entryId, {
        contactType: contactForm.contactType,
        contactedAt: new Date(contactForm.contactedAt).toISOString(),
        result: contactForm.result || undefined,
        nextContactAt: contactForm.nextContactAt
          ? new Date(contactForm.nextContactAt).toISOString()
          : undefined,
        comment: contactForm.comment || undefined,
      });
      toast({ title: 'Контакт зафиксирован' });
      setDialog(null);
      setContactForm({
        contactType: 'call',
        contactedAt: new Date().toISOString().slice(0, 16),
        result: '',
        nextContactAt: '',
        comment: '',
      });
      await load();
      if (selected?.id === entryId) {
        const full = await api.b2b.diary.getEntry(entryId);
        setDetail(full);
      }
    } catch (err) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
    }
  };

  const submitDeal = async () => {
    if (!selected) return;
    try {
      const students = Number(dealForm.studentsCount);
      const price = dealForm.pricePerStudent ? String(dealForm.pricePerStudent) : undefined;
      let amount = dealForm.amount;
      if (!amount && price && students) {
        amount = String(Number(price) * students);
      }
      await api.b2b.diary.createDeal(selected.id, {
        studentsCount: students,
        pricePerStudent: price,
        amount: String(amount),
        currency: dealForm.currency || 'BYN',
        contractDate: dealForm.contractDate || undefined,
        startDate: dealForm.startDate || undefined,
        comment: dealForm.comment || undefined,
        groupId: dealForm.groupId || undefined,
      });
      toast({ title: 'Договор зафиксирован' });
      setDialog(null);
      await load();
      const full = await api.b2b.diary.getEntry(selected.id);
      setDetail(full);
    } catch (err) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
    }
  };

  const filteredCount = useMemo(() => entries.length, [entries]);

  if (loading && entries.length === 0) {
    return <PageLoading label="Загрузка дневника продаж" />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Дневник продаж</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Организации для отработки — {user?.full_name || user?.email}
          </p>
        </div>
        <Link to={createPageUrl('SalesManagerDashboard')} className="text-sm text-primary hover:underline">
          Мои продажи →
        </Link>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">В работе</p>
            <p className="text-xl font-bold">{summary.organizations_in_work ?? 0}</p>
          </Card>
          <Card className="p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Переговоры</p>
            <p className="text-xl font-bold">{summary.negotiations ?? 0}</p>
          </Card>
          <Card className="p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Договоров</p>
            <p className="text-xl font-bold">{summary.contracts_signed ?? 0}</p>
          </Card>
          <Card className="p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Потенциал / факт</p>
            <p className="text-lg font-bold">
              {summary.potential_students ?? 0} / {summary.actual_students ?? 0}
            </p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {SALES_DIARY_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`min-h-touch px-3 py-1.5 rounded-lg text-sm border ${
              filter === f.id
                ? 'bg-foreground text-background border-transparent'
                : 'bg-card text-muted-foreground border-border'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <SearchField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по названию или УНП..."
        className="max-w-md"
        aria-label="Поиск организации"
      />

      {filteredCount === 0 ? (
        <EmptyState
          preset="generic"
          title="Организаций в дневнике пока нет"
          description="Администратор добавит организации для отработки"
          icon={Building2}
        />
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => (
            <DiaryEntryCard
              key={entry.id}
              entry={entry}
              onOpen={openDetail}
              onQuickContact={(e) => {
                setSelected(e);
                setDialog('contact');
              }}
            />
          ))}
        </div>
      )}

      <Button type="button" intent="outline" onClick={load}>Обновить</Button>

      <ResponsiveDialog open={dialog === 'contact'} onOpenChange={(open) => !open && setDialog(null)}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Добавить контакт</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="space-y-3 px-1">
          <label className="block text-sm">
            <span className="text-muted-foreground">Тип</span>
            <select
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={contactForm.contactType}
              onChange={(e) => setContactForm((f) => ({ ...f, contactType: e.target.value }))}
            >
              {SALES_DIARY_CONTACT_TYPES.map((t) => (
                <option key={t} value={t}>{SALES_DIARY_CONTACT_LABELS[t]}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Дата и время</span>
            <Input
              type="datetime-local"
              className="mt-1"
              value={contactForm.contactedAt}
              onChange={(e) => setContactForm((f) => ({ ...f, contactedAt: e.target.value }))}
            />
          </label>
          <Input
            value={contactForm.result}
            onChange={(e) => setContactForm((f) => ({ ...f, result: e.target.value }))}
            placeholder="Краткий результат"
          />
          <label className="block text-sm">
            <span className="text-muted-foreground">Следующий контакт</span>
            <Input
              type="datetime-local"
              className="mt-1"
              value={contactForm.nextContactAt}
              onChange={(e) => setContactForm((f) => ({ ...f, nextContactAt: e.target.value }))}
            />
          </label>
          <Textarea
            value={contactForm.comment}
            onChange={(e) => setContactForm((f) => ({ ...f, comment: e.target.value }))}
            placeholder="Комментарий"
            rows={3}
          />
        </div>
        <ResponsiveDialogFooter>
          <Button type="button" onClick={() => submitContact()}>Сохранить</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialog>

      <ResponsiveDialog open={dialog === 'detail'} onOpenChange={(open) => !open && setDialog(null)}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {detail?.organization_name ?? selected?.organization_name ?? 'Организация'}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        {detailLoading ? (
          <PageLoading label="Загрузка..." />
        ) : detail ? (
          <div className="space-y-4 px-1 max-h-[70vh] overflow-y-auto">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <p><span className="text-muted-foreground">УНП:</span> {detail.organization_unp || '—'}</p>
              <p><span className="text-muted-foreground">Добавлено:</span> {formatDiaryDate(detail.created_at)}</p>
              <p><span className="text-muted-foreground">Поступило:</span> {formatMoney(detail.receipts_total)}</p>
              <p><span className="text-muted-foreground">Договор (сумма):</span> {formatMoney(detail.expected_contract_amount)}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Статус</label>
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
              >
                {SALES_DIARY_STATUSES.map((s) => (
                  <option key={s} value={s}>{SALES_DIARY_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-muted-foreground">Следующий контакт</span>
                <Input
                  type="datetime-local"
                  className="mt-1"
                  value={editForm.nextContactAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, nextContactAt: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Потенциал (сотрудников)</span>
                <NumberInput
                  className="mt-1"
                  value={editForm.potentialStudentsCount}
                  onChange={(e) => setEditForm((f) => ({ ...f, potentialStudentsCount: e.target.value }))}
                  min={0}
                />
              </label>
            </div>

            <Button type="button" size="sm" onClick={saveEntry}>Сохранить изменения</Button>

            <div className="border-t pt-4 space-y-2">
              <p className="font-medium flex items-center gap-2"><FileText className="w-4 h-4" /> Мои заметки</p>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Новая заметка..."
                rows={3}
              />
              <Button type="button" size="sm" intent="outline" onClick={submitNote} disabled={!noteText.trim()}>
                Добавить заметку
              </Button>
              {(detail.notes ?? []).length > 0 && (
                <ul className="space-y-2 text-sm">
                  {detail.notes.map((n) => (
                    <li key={n.id} className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">{formatDiaryDate(n.created_at)}</p>
                      <p className="whitespace-pre-wrap break-words">{n.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t pt-4 space-y-2">
              <p className="font-medium flex items-center gap-2"><CalendarClock className="w-4 h-4" /> История контактов</p>
              {(detail.contacts ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Контактов пока нет</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {detail.contacts.map((c) => (
                    <li key={c.id} className="rounded-lg border p-2">
                      <p className="font-medium">
                        {formatDiaryDateTime(c.contacted_at)} · {SALES_DIARY_CONTACT_LABELS[c.contact_type]}
                      </p>
                      {c.result && <p>{c.result}</p>}
                      {c.next_contact_at && (
                        <p className="text-muted-foreground">Следующий: {formatDiaryDate(c.next_contact_at)}</p>
                      )}
                      {c.comment && <p className="text-muted-foreground italic">{c.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" size="sm" intent="outline" onClick={() => setDialog('contact')}>
                Добавить контакт
              </Button>
            </div>

            <div className="border-t pt-4 space-y-3">
              <p className="font-medium flex items-center gap-2"><Handshake className="w-4 h-4" /> Договор</p>
              {(detail.deals ?? []).length > 0 && (
                <ul className="space-y-2 text-sm">
                  {detail.deals.map((d) => (
                    <li key={d.id} className="rounded-lg bg-green-50 dark:bg-green-950/30 p-2">
                      <p>{d.students_count} сотрудников · {formatMoney(d.amount, d.currency)}</p>
                      {d.contract_date && <p className="text-muted-foreground">Дата: {formatDiaryDate(d.contract_date)}</p>}
                      {d.group_id && <p className="text-xs text-muted-foreground">Группа: {d.group_id.slice(0, 8)}…</p>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid sm:grid-cols-2 gap-2">
                <NumberInput
                  placeholder="Кол-во сотрудников"
                  value={dealForm.studentsCount}
                  onChange={(e) => setDealForm((f) => ({ ...f, studentsCount: e.target.value }))}
                  min={1}
                />
                <NumberInput
                  placeholder="Цена за человека"
                  value={dealForm.pricePerStudent}
                  onChange={(e) => setDealForm((f) => ({ ...f, pricePerStudent: e.target.value }))}
                />
                <Input
                  placeholder="Общая сумма"
                  value={dealForm.amount}
                  onChange={(e) => setDealForm((f) => ({ ...f, amount: e.target.value }))}
                />
                <Input
                  placeholder="Валюта"
                  value={dealForm.currency}
                  onChange={(e) => setDealForm((f) => ({ ...f, currency: e.target.value }))}
                />
                <Input
                  type="date"
                  value={dealForm.contractDate}
                  onChange={(e) => setDealForm((f) => ({ ...f, contractDate: e.target.value }))}
                />
                <Input
                  type="date"
                  value={dealForm.startDate}
                  onChange={(e) => setDealForm((f) => ({ ...f, startDate: e.target.value }))}
                />
                <Input
                  className="sm:col-span-2"
                  placeholder="ID группы (необязательно)"
                  value={dealForm.groupId}
                  onChange={(e) => setDealForm((f) => ({ ...f, groupId: e.target.value }))}
                />
                <Textarea
                  className="sm:col-span-2"
                  placeholder="Комментарий к договору"
                  value={dealForm.comment}
                  onChange={(e) => setDealForm((f) => ({ ...f, comment: e.target.value }))}
                  rows={2}
                />
              </div>
              <Button type="button" onClick={submitDeal} disabled={!dealForm.studentsCount}>
                Организация заключает договор
              </Button>
              <p className="text-xs text-muted-foreground">
                Договор не создаёт поступление автоматически. Деньги регистрирует администратор в разделе B2B.
              </p>
            </div>
          </div>
        ) : null}
      </ResponsiveDialog>
    </div>
  );
}
