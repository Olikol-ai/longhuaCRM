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
  Loader2, Phone, Plus, Pencil, Trash2, Search, BookUser, X, Wallet,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';

function normalizeSearch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function formatLessonDate(date, time) {
  if (!date) return '—';
  const t = String(time || '').slice(0, 5);
  return t ? `${date} ${t}` : date;
}

const STATUS_RU = {
  planned: 'Запланирован',
  completed: 'Проведён',
  cancelled: 'Отменён',
  rescheduled: 'Перенесён',
  missed: 'Пропущен',
  missed_no_notice: 'Пропущен без уведомления',
};

const emptyForm = { name: '', phone: '', comment: '' };

/**
 * Shared private students notebook for teacher or tutor.
 * @param {'teacher'|'tutor'} ownerType
 */
export default function PrivateStudentsNotebook({ ownerType = 'teacher' }) {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [balanceForm, setBalanceForm] = useState({ newBalance: '', reason: '' });
  const [balanceSaving, setBalanceSaving] = useState(false);

  const loadData = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const rows = await api.teacherStudentContacts.listMine({ ownerType });
      setStudents(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setLoadError(err?.message || 'Не удалось загрузить записи');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id) => {
    setDetailLoading(true);
    try {
      const row = await api.teacherStudentContacts.detail(id);
      setDetail(row);
      setBalanceForm({
        newBalance: String(row.lesson_balance ?? row.lessonBalance ?? 0),
        reason: '',
      });
    } catch (err) {
      toast({
        title: 'Не удалось открыть карточку',
        description: userFacingError(err),
        variant: 'destructive',
      });
      setSelectedId(null);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ownerType]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    return [...students]
      .filter((s) => {
        if (!q) return true;
        const hay = [s.name, s.phone, s.comment]
          .filter(Boolean)
          .map((v) => normalizeSearch(v))
          .join(' ');
        return hay.includes(q);
      })
      .sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'ru', {
          sensitivity: 'base',
        }),
      );
  }, [students, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || '',
      phone: row.phone || '',
      comment: row.comment || '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
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
      if (editing?.id) {
        await api.teacherStudentContacts.update(editing.id, payload);
        toast({ title: 'Запись обновлена' });
      } else {
        await api.teacherStudentContacts.createMine(payload, { ownerType });
        toast({ title: 'Ученик добавлен' });
      }
      closeForm();
      await loadData();
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Удалить «${row.name}» из списка?`)) return;
    setDeletingId(row.id);
    try {
      await api.teacherStudentContacts.remove(row.id);
      toast({ title: 'Запись удалена' });
      if (selectedId === row.id) {
        setSelectedId(null);
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
      setDeletingId(null);
    }
  };

  const handleBalanceSave = async (e) => {
    e.preventDefault();
    if (!selectedId) return;
    const newBalance = Number(balanceForm.newBalance);
    if (!Number.isInteger(newBalance) || newBalance < 0) {
      toast({ title: 'Укажите целое число ≥ 0', variant: 'destructive' });
      return;
    }
    setBalanceSaving(true);
    try {
      await api.teacherStudentContacts.updateBalance(selectedId, {
        newBalance,
        reason: balanceForm.reason.trim() || null,
      });
      toast({ title: 'Баланс обновлён' });
      await loadData();
      await loadDetail(selectedId);
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

  const testId = ownerType === 'tutor' ? 'tutor-contacts-page' : 'teacher-contacts-page';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5" data-testid={testId}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookUser className="h-6 w-6 text-brand" />
            Ученики
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {getGreetingName(user)}, личный список для расписания и баланса занятий
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          data-testid={ownerType === 'tutor' ? 'tutor-contacts-add' : 'teacher-contacts-add'}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Добавить ученика
        </Button>
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по ФИО..."
          className="pl-9"
        />
      </div>

      <p className="text-xs text-slate-400">{filtered.length} записей</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {filtered.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <p className="text-slate-400">Пока никого нет</p>
              <Button type="button" variant="outline" onClick={openCreate}>
                Добавить первого ученика
              </Button>
            </Card>
          ) : (
            filtered.map((s) => {
              const balance = s.lesson_balance ?? s.lessonBalance ?? 0;
              const last = formatLessonDate(
                s.last_lesson_date ?? s.lastLessonDate,
                s.last_lesson_start_time ?? s.lastLessonStartTime,
              );
              return (
                <Card
                  key={s.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedId === s.id
                      ? 'border-brand ring-1 ring-brand/30'
                      : 'hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedId(s.id)}
                >
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{s.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    Баланс занятий: <span className="font-semibold">{balance}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Последний урок: {last}</p>
                </Card>
              );
            })
          )}
        </div>

        <div className="lg:col-span-3">
          {!selectedId ? (
            <Card className="p-8 text-center text-slate-400">
              Выберите ученика, чтобы открыть карточку
            </Card>
          ) : detailLoading || !detail ? (
            <Card className="p-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </Card>
          ) : (
            <Card className="p-5 space-y-5" data-testid="private-student-card">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{detail.name}</h2>
                  {detail.phone && (
                    <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                      <Phone className="w-3.5 h-3.5" /> {detail.phone}
                    </p>
                  )}
                  {detail.comment && (
                    <p className="text-sm text-slate-500 mt-2 whitespace-pre-wrap">{detail.comment}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(detail)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Изменить
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200"
                    disabled={deletingId === detail.id}
                    onClick={() => handleDelete(detail)}
                  >
                    {deletingId === detail.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4" /> Баланс занятий
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {detail.lesson_balance ?? detail.lessonBalance ?? 0}
                </p>
              </div>

              <form onSubmit={handleBalanceSave} className="space-y-3 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold">Изменить баланс занятий</h3>
                <p className="text-xs text-slate-500">
                  Текущее значение: {detail.lesson_balance ?? detail.lessonBalance ?? 0}
                </p>
                <div className="space-y-2">
                  <Label>Новое значение</Label>
                  <Input
                    type="number"
                    min={0}
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
                  <p className="text-xs text-slate-400">Пока нет уроков</p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {detail.lessons.map((l) => (
                      <li
                        key={l.id}
                        className="text-sm flex justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1"
                      >
                        <span>
                          {formatLessonDate(l.date, l.start_time || l.startTime)} · {l.duration} мин
                        </span>
                        <span className="text-slate-500 shrink-0">
                          {STATUS_RU[l.status] || l.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">История изменений баланса</h3>
                {(detail.balance_history || detail.balanceHistory || []).length === 0 ? (
                  <p className="text-xs text-slate-400">Изменений пока нет</p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {(detail.balance_history || detail.balanceHistory).map((h) => {
                      const change = h.change_amount ?? h.changeAmount ?? 0;
                      const sign = change > 0 ? '+' : '';
                      return (
                        <li
                          key={h.id}
                          className="text-sm border-b border-slate-100 dark:border-slate-800 pb-2"
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
                            <p className="text-xs text-slate-400 mt-0.5">{h.reason}</p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {h.created_at || h.createdAt
                              ? new Date(h.created_at || h.createdAt).toLocaleString('ru-RU')
                              : ''}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-semibold">
                {editing ? 'Изменить ученика' : 'Добавить ученика'}
              </h2>
              <button type="button" onClick={closeForm} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
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
