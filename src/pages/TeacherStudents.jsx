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
  Loader2, Phone, Plus, Pencil, Trash2, Search, BookUser, X,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';

function normalizeSearch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const emptyForm = { name: '', phone: '', comment: '' };

/**
 * Personal notebook of teacher students for scheduling.
 * Not CRM Users / school Students — local contacts only.
 */
export default function TeacherStudents() {
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

  const loadData = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const rows = await api.teacherStudentContacts.listMine({ ownerType: 'teacher' });
      setStudents(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setLoadError(err?.message || 'Не удалось загрузить записи');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
        await api.teacherStudentContacts.createMine(payload, { ownerType: 'teacher' });
        toast({ title: 'Ученик добавлен' });
      }
      closeForm();
      await loadData();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5" data-testid="teacher-contacts-page">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookUser className="h-6 w-6 text-brand" />
            Ученики
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {getGreetingName(user)}, личный список для расписания — это не ученики CRM
          </p>
        </div>
        <Button type="button" onClick={openCreate} data-testid="teacher-contacts-add">
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

      {filtered.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <p className="text-slate-400">Пока никого нет</p>
          <Button type="button" variant="outline" onClick={openCreate}>
            Добавить первого ученика
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Card key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{s.name}</p>
                {s.phone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {s.phone}
                  </p>
                )}
                {s.comment && (
                  <p className="text-xs text-slate-400 line-clamp-2 whitespace-pre-wrap">{s.comment}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button type="button" variant="outline" size="sm" onClick={() => openEdit(s)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Изменить
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  disabled={deletingId === s.id}
                  onClick={() => handleDelete(s)}
                >
                  {deletingId === s.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

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
            <form onSubmit={handleSave} className="p-5 space-y-4" data-testid="teacher-contacts-form">
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
