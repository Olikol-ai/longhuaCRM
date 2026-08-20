import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { getGreetingName } from '@/lib/display-name';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2, Phone, Plus, Pencil, Trash2, Search, BookUser, X, Wallet, Mail,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import {
  STUDENT_KIND_LABEL,
  STUDENT_STATUS_LABEL,
  buildOwnerStudentRows,
  filterOwnerStudentRows,
  normalizePersonName,
  displayName,
} from '@/lib/ownerStudents';
import {
  getLessonBalance,
} from '@/lib/lessonBalance';
import LessonBalanceDisplay from '@/components/students/LessonBalanceDisplay';

function formatLessonDate(date, time) {
  if (!date) return '—';
  const t = String(time || '').slice(0, 5);
  return t ? `${date} ${t}` : date;
}

const TABS = [
  { id: 'all', label: 'Все' },
  { id: 'registered', label: 'Зарегистрированные' },
  { id: 'manual', label: 'Добавленные вручную' },
];

const emptyForm = { name: '', phone: '', comment: '' };

const LESSON_STATUS_RU = {
  planned: 'Запланирован',
  completed: 'Проведён',
  cancelled: 'Отменён',
  rescheduled: 'Перенесён',
  missed: 'Пропущен',
  missed_no_notice: 'Пропущен без уведомления',
};

/**
 * Unified "Ученики" section for teacher or tutor.
 * @param {'teacher'|'tutor'} ownerType
 */
export default function PrivateStudentsNotebook({ ownerType = 'teacher' }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [tutorStudentsRaw, setTutorStudentsRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [balanceForm, setBalanceForm] = useState({ newBalance: '', reason: '' });
  const [balanceSaving, setBalanceSaving] = useState(false);

  const selectedRow = useMemo(
    () => rows.find((row) => row.key === selectedKey) || null,
    [rows, selectedKey],
  );

  const loadData = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      if (ownerType === 'teacher') {
        const [contacts, schoolStudents] = await Promise.all([
          api.teacherStudentContacts.listMine({ ownerType: 'teacher' }),
          api.students.list?.() ?? api.students.filter({}),
        ]);
        const schoolRows = Array.isArray(schoolStudents)
          ? schoolStudents
          : schoolStudents?.items || [];
        setTutorStudentsRaw([]);
        setRows(
          buildOwnerStudentRows('teacher', {
            contacts: Array.isArray(contacts) ? contacts : [],
            schoolStudents: schoolRows,
          }),
        );
      } else {
        const [contacts, tutorStudents] = await Promise.all([
          api.teacherStudentContacts.listMine({ ownerType: 'tutor' }),
          api.tutors.myStudents(),
        ]);
        const tutorRows = Array.isArray(tutorStudents) ? tutorStudents : [];
        setTutorStudentsRaw(tutorRows);
        setRows(
          buildOwnerStudentRows('tutor', {
            contacts: Array.isArray(contacts) ? contacts : [],
            tutorStudents: tutorRows,
          }),
        );
      }
    } catch (err) {
      setLoadError(err?.message || 'Не удалось загрузить учеников');
      setRows([]);
      setTutorStudentsRaw([]);
    } finally {
      setLoading(false);
    }
  };

  const loadContactDetail = async (id) => {
    setDetailLoading(true);
    try {
      const row = await api.teacherStudentContacts.detail(id);
      setDetail({ type: 'contact', data: row });
      setBalanceForm({
        newBalance: String(getLessonBalance(row)),
        reason: '',
      });
    } catch (err) {
      toast({
        title: 'Не удалось открыть карточку',
        description: userFacingError(err),
        variant: 'destructive',
      });
      setSelectedKey(null);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ownerType]);

  useEffect(() => {
    if (!selectedRow) {
      setDetail(null);
      return;
    }
    if (selectedRow.usesContactDetail) {
      loadContactDetail(selectedRow.id);
      return;
    }
    setDetail({ type: selectedRow.source, data: selectedRow });
    setDetailLoading(false);
  }, [selectedRow?.key]);

  const filtered = useMemo(
    () => filterOwnerStudentRows(rows, { tab, query }),
    [rows, tab, query],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      registered: rows.filter((row) => row.kind === 'registered').length,
      manual: rows.filter((row) => row.kind === 'manual').length,
    }),
    [rows],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    if (!row?.canEdit) return;
    setEditing(row);
    setForm({
      name: row.name || '',
      phone: row.phone || '',
      comment:
        row.source === 'contact'
          ? row.raw?.comment || ''
          : row.raw?.notes || row.raw?.comment || '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const findMatchingTutorStudent = (name, phone) => {
    const wantName = normalizePersonName(name);
    const wantPhone = String(phone || '').trim();
    return tutorStudentsRaw.find((row) => {
      if (row.user_id || row.userId) return false;
      if (normalizePersonName(displayName(row)) !== wantName) return false;
      if (!wantPhone) return true;
      return String(row.phone || '').trim() === wantPhone;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast({ title: 'Укажите ФИО', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        phone: form.phone.trim() || null,
        comment: form.comment.trim() || null,
      };

      let savedContactId = null;
      if (editing) {
        if (editing.source === 'contact') {
          const saved = await api.teacherStudentContacts.update(editing.id, payload);
          savedContactId = editing.id;
          // Immediately refresh the open card so the UI does not keep stale detail
          // (list reload alone does not re-trigger detail fetch — same row key).
          setDetail((prev) =>
            prev?.type === 'contact'
              ? {
                  type: 'contact',
                  data: {
                    ...(prev.data || {}),
                    ...(saved || {}),
                    name: saved?.name ?? name,
                    phone: saved?.phone ?? payload.phone,
                    comment: saved?.comment ?? payload.comment,
                  },
                }
              : prev,
          );
          if (ownerType === 'tutor') {
            const twin = findMatchingTutorStudent(editing.name, editing.phone);
            if (twin?.id) {
              await api.tutors.updateMyStudent(twin.id, {
                name,
                phone: payload.phone,
                notes: payload.comment,
              });
            }
          }
        } else if (editing.source === 'tutor_student') {
          await api.tutors.updateMyStudent(editing.id, {
            name,
            phone: payload.phone,
            notes: payload.comment,
          });
        } else {
          throw new Error('Эту запись нельзя изменить здесь');
        }
        toast({ title: 'Изменения успешно сохранены' });
      } else {
        await api.teacherStudentContacts.createMine(payload, { ownerType });
        if (ownerType === 'tutor') {
          await api.tutors.createMyStudent({
            name,
            phone: payload.phone,
            notes: payload.comment,
          });
        }
        toast({ title: 'Ученик добавлен' });
        setTab('manual');
      }
      closeForm();
      await loadData();
      if (savedContactId && selectedKey === `contact:${savedContactId}`) {
        await loadContactDetail(savedContactId);
      }
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        description: userFacingError(err),
        variant: 'destructive',
      });
      // Keep the form open with entered values so the user can fix and retry.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!row?.canDelete) return;
    if (row.user_id || row.userId) {
      toast({
        title: 'Нельзя удалить',
        description: 'Зарегистрированный ученик удаляется только через админку.',
        variant: 'destructive',
      });
      return;
    }
    const confirmed = window.confirm(
      `Архивировать «${row.name}»?\n\nЗапись исчезнет из списка. Запланированные уроки будут отменены. История уроков и баланса сохранится.`,
    );
    if (!confirmed) return;
    setDeletingKey(row.key);
    try {
      let cancelledLessons = 0;
      if (row.source === 'contact') {
        if (ownerType === 'tutor') {
          const twin = findMatchingTutorStudent(row.name, row.phone);
          if (twin?.id && !twin.user_id && !twin.userId) {
            const twinResult = await api.tutors.deleteMyStudent(twin.id);
            cancelledLessons += Number(twinResult?.cancelled_lessons ?? twinResult?.cancelledLessons ?? 0);
          }
        }
        const result = await api.teacherStudentContacts.remove(row.id);
        cancelledLessons += Number(result?.cancelled_lessons ?? result?.cancelledLessons ?? 0);
      } else if (row.source === 'tutor_student') {
        const result = await api.tutors.deleteMyStudent(row.id);
        cancelledLessons += Number(result?.cancelled_lessons ?? result?.cancelledLessons ?? 0);
      } else {
        throw new Error('Эту запись нельзя удалить здесь');
      }
      toast({
        title: 'Ученик архивирован',
        description:
          cancelledLessons > 0
            ? `Отменено запланированных уроков: ${cancelledLessons}`
            : undefined,
      });
      if (selectedKey === row.key) {
        setSelectedKey(null);
        setDetail(null);
      }
      await loadData();
    } catch (err) {
      toast({
        title: 'Не удалось удалить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setDeletingKey(null);
    }
  };

  const handleBalanceSave = async (e) => {
    e.preventDefault();
    if (!selectedRow?.usesContactDetail) return;
    const newBalance = Number(balanceForm.newBalance);
    if (!Number.isInteger(newBalance)) {
      toast({
        title: 'Укажите целое число баланса',
        description: 'Допускаются отрицательные значения (задолженность).',
        variant: 'destructive',
      });
      return;
    }
    setBalanceSaving(true);
    try {
      // Teacher: backend writes students.lesson_balance (SSOT) via linkedStudentId.
      // Tutor: backend writes tutor_contact_balances via contact updateBalance.
      await api.teacherStudentContacts.updateBalance(selectedRow.id, {
        newBalance,
        reason: balanceForm.reason.trim() || null,
      });
      toast({ title: 'Баланс обновлён' });
      await loadData();
      await loadContactDetail(selectedRow.id);
    } catch (err) {
      toast({
        title: 'Не удалось изменить баланс',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setBalanceSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const testId = ownerType === 'tutor' ? 'tutor-students-page' : 'teacher-students-page';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5" data-testid={testId}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <BookUser className="h-6 w-6 text-brand" />
            Ученики
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {getGreetingName(user)
              ? `${getGreetingName(user)}, зарегистрированные и добавленные вручную в одном списке`
              : 'Зарегистрированные и добавленные вручную в одном списке'}
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          data-testid={ownerType === 'tutor' ? 'tutor-students-add' : 'teacher-students-add'}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Добавить ученика
        </Button>
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Тип учеников">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                active
                  ? 'bg-brand text-white border-brand'
                  : 'bg-card border-border text-foreground'
              }`}
              data-testid={`students-tab-${item.id}`}
            >
              {item.label}
              <span className={`ml-1.5 text-xs ${active ? 'text-white/80' : 'text-muted-foreground'}`}>
                {counts[item.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по ФИО, телефону, email..."
          className="pl-9"
        />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} записей</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {filtered.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <p className="text-muted-foreground">Пока никого нет</p>
              <Button type="button" variant="outline" onClick={openCreate}>
                Добавить ученика
              </Button>
            </Card>
          ) : (
            filtered.map((s) => (
              <Card
                key={s.key}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedKey === s.key
                    ? 'border-brand ring-1 ring-brand/30'
                    : 'hover:border-border'
                }`}
                onClick={() => setSelectedKey(s.key)}
                data-testid={`student-row-${s.kind}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground truncate">{s.name}</p>
                  <span
                    className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${
                      s.kind === 'registered'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                    }`}
                  >
                    {STUDENT_KIND_LABEL[s.kind]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Баланс:{' '}
                  <LessonBalanceDisplay
                    balance={s.lesson_balance == null ? null : getLessonBalance(s)}
                  />
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {STUDENT_STATUS_LABEL[s.status] || s.status || '—'}
                  {s.phone ? ` · ${s.phone}` : ''}
                </p>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-3">
          {!selectedRow ? (
            <Card className="p-8 text-center text-muted-foreground">
              Выберите ученика, чтобы открыть карточку
            </Card>
          ) : detailLoading || !detail ? (
            <Card className="p-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </Card>
          ) : selectedRow.usesContactDetail ? (
            <ContactDetailCard
              detail={detail.data}
              selectedRow={selectedRow}
              deletingKey={deletingKey}
              balanceForm={balanceForm}
              setBalanceForm={setBalanceForm}
              balanceSaving={balanceSaving}
              onEdit={() => openEdit(selectedRow)}
              onDelete={() => handleDelete(selectedRow)}
              onBalanceSave={handleBalanceSave}
            />
          ) : (
            <AccountOrNotebookCard
              row={selectedRow}
              deletingKey={deletingKey}
              onEdit={() => openEdit(selectedRow)}
              onDelete={() => handleDelete(selectedRow)}
            />
          )}
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-xl border border-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">
                {editing ? 'Изменить ученика' : 'Добавить ученика'}
              </h2>
              <button type="button" onClick={closeForm} className="p-2 rounded-lg hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Создаётся запись без аккаунта: для расписания, баланса и ручной проверки ДЗ.
                Уведомления и вход в кабинет не создаются.
              </p>
              <div className="space-y-2">
                <Label>ФИО *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Иванов Иван"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+375…"
                />
              </div>
              <div className="space-y-2">
                <Label>Комментарий</Label>
                <Textarea
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  rows={3}
                  placeholder="Заметки для себя"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={closeForm}>Отмена</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Сохранить
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactDetailCard({
  detail,
  selectedRow,
  deletingKey,
  balanceForm,
  setBalanceForm,
  balanceSaving,
  onEdit,
  onDelete,
  onBalanceSave,
}) {
  return (
    <Card className="p-5 space-y-5" data-testid="private-student-card">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{detail.name}</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
              {STUDENT_KIND_LABEL.manual}
            </span>
          </div>
          {detail.phone && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <Phone className="w-3.5 h-3.5" /> {detail.phone}
            </p>
          )}
          {detail.comment && (
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{detail.comment}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Статус: {STUDENT_STATUS_LABEL[detail.status] || detail.status || '—'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Изменить
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200"
            disabled={deletingKey === selectedRow.key}
            onClick={onDelete}
          >
            {deletingKey === selectedRow.key ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Wallet className="w-4 h-4" /> Баланс занятий
        </p>
        <LessonBalanceDisplay
          balance={getLessonBalance(detail)}
          variant="hero"
          showDebtHint
          className="mt-1"
        />
      </div>

      <form onSubmit={onBalanceSave} className="space-y-3 border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold">Изменить баланс занятий</h3>
        <div className="space-y-2">
          <Label>Новое значение</Label>
          <Input
            type="number"
            step={1}
            value={balanceForm.newBalance}
            onChange={(e) => setBalanceForm((f) => ({ ...f, newBalance: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Причина изменения</Label>
          <Input
            value={balanceForm.reason}
            onChange={(e) => setBalanceForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="необязательно"
          />
        </div>
        <Button type="submit" disabled={balanceSaving} size="sm">
          {balanceSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Сохранить баланс
        </Button>
      </form>

      <div>
        <h3 className="text-sm font-semibold mb-2">История занятий</h3>
        {(detail.lessons || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Пока нет уроков</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {detail.lessons.map((l) => (
              <li
                key={l.id}
                className="text-sm flex justify-between gap-2 border-b border-border pb-1"
              >
                <span>
                  {formatLessonDate(l.date, l.start_time || l.startTime)} · {l.duration} мин
                </span>
                <span className="text-muted-foreground shrink-0">
                  {LESSON_STATUS_RU[l.status] || l.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">История изменений баланса</h3>
        {(detail.balance_history || detail.balanceHistory || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Изменений пока нет</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {(detail.balance_history || detail.balanceHistory).map((h) => {
              const change = h.change_amount ?? h.changeAmount ?? 0;
              const sign = change > 0 ? '+' : '';
              return (
                <li
                  key={h.id}
                  className="text-sm border-b border-border pb-2"
                >
                  <div className="flex justify-between gap-2">
                    <span>
                      Было: {h.old_balance ?? h.oldBalance} → Стало:{' '}
                      {h.new_balance ?? h.newBalance}
                    </span>
                    <span className={change >= 0 ? 'text-emerald-600' : 'text-amber-700'}>
                      {sign}{change}
                    </span>
                  </div>
                  {h.reason && (
                    <p className="text-xs text-muted-foreground mt-0.5">{h.reason}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function AccountOrNotebookCard({ row, deletingKey, onEdit, onDelete }) {
  return (
    <Card className="p-5 space-y-4" data-testid="registered-student-card">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{row.name}</h2>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                row.kind === 'registered'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              {STUDENT_KIND_LABEL[row.kind]}
            </span>
          </div>
          {row.phone && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <Phone className="w-3.5 h-3.5" /> {row.phone}
            </p>
          )}
          {row.email && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5" /> {row.email}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Статус: {STUDENT_STATUS_LABEL[row.status] || row.status || '—'}
          </p>
        </div>
        {(row.canEdit || row.canDelete) && (
          <div className="flex gap-2 shrink-0">
            {row.canEdit && (
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Изменить
              </Button>
            )}
            {row.canDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200"
                disabled={deletingKey === row.key}
                onClick={onDelete}
              >
                {deletingKey === row.key ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Wallet className="w-4 h-4" /> Баланс занятий
        </p>
        <LessonBalanceDisplay
          balance={row.lesson_balance == null ? null : getLessonBalance(row)}
          variant="hero"
          showDebtHint
          className="mt-1"
        />
        {row.kind === 'registered' && (
          <p className="text-xs text-muted-foreground mt-2">
            Зарегистрированный ученик: есть кабинет и уведомления. Добавление вручную создаёт
            только CRM-запись без аккаунта.
          </p>
        )}
      </div>
    </Card>
  );
}
