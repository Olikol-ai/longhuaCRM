import { useEffect, useState } from 'react';
import { api } from '@/api';
import {
  Button,
  Input,
  ResponsiveDialog,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';

function formatBalance(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value)} занятий`;
}

export default function StudentMergeDialog({ user, open, onOpenChange, onMerged }) {
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);

  const primaryStudentId = user?.student_profile_id;

  useEffect(() => {
    if (!open || !primaryStudentId) return;
    setSelected(null);
    setSearch('');
  }, [open, primaryStudentId]);

  useEffect(() => {
    if (!open || !primaryStudentId) return undefined;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await api.students.mergeCandidates({
          primaryStudentId,
          search: search.trim(),
        });
        setCandidates(Array.isArray(rows) ? rows : []);
      } catch {
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [open, primaryStudentId, search]);

  if (!user || !primaryStudentId) return null;

  const primaryBalance = Number(user.lesson_balance ?? 0);
  const secondaryBalance = Number(selected?.lesson_balance ?? 0);
  const resultingBalance = primaryBalance + secondaryBalance;

  const merge = async () => {
    if (!selected) return;
    setMerging(true);
    try {
      await api.students.merge(primaryStudentId, selected.id);
      toast({ title: 'Ученики объединены' });
      onOpenChange(false);
      await onMerged?.();
    } catch (err) {
      toast({
        title: 'Не удалось объединить',
        description: userFacingError(err, 'Проверьте выбранные профили'),
        variant: 'destructive',
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Объединение учеников</ResponsiveDialogTitle>
      </ResponsiveDialogHeader>
      <div className="space-y-4 px-1">
        <div className="rounded-xl border border-border p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Основной аккаунт</p>
          <p className="font-semibold">{user.full_name || user.email}</p>
          <p className="text-sm text-muted-foreground">{user.email || '—'}</p>
          <p className="text-sm mt-2">Баланс аккаунта: {formatBalance(primaryBalance)}</p>
        </div>

        <label className="block text-sm">
          <span className="text-muted-foreground">Объединить с</span>
          <Input
            className="mt-1"
            placeholder="Поиск ученика..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <div className="max-h-52 overflow-y-auto space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Поиск...</p>}
          {!loading && candidates.length === 0 && (
            <p className="text-sm text-muted-foreground">Подходящие ученики не найдены</p>
          )}
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className={`w-full text-left rounded-xl border p-3 transition-colors ${
                selected?.id === candidate.id
                  ? 'border-brand bg-brand-muted/40'
                  : 'border-border hover:bg-muted/40'
              }`}
              onClick={() => setSelected(candidate)}
            >
              <p className="font-medium">{candidate.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {candidate.email || '—'} · {candidate.phone || '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Преподаватель: {candidate.assigned_teacher_name || '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                Баланс: {formatBalance(candidate.lesson_balance)}
                {candidate.group_names?.length ? ` · Группы: ${candidate.group_names.join(', ')}` : ''}
              </p>
            </button>
          ))}
        </div>

        {selected && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">Перед объединением</p>
            <p className="text-muted-foreground mt-1">
              Баланс аккаунта: {formatBalance(primaryBalance)}
            </p>
            <p className="text-muted-foreground">
              Баланс ученика: {formatBalance(secondaryBalance)}
            </p>
            <p className="font-semibold mt-2">
              Результат: {formatBalance(resultingBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              После объединения данные выбранного ученика будут перенесены в основной аккаунт.
              Операцию необходимо выполнить аккуратно, чтобы не создать дубликаты.
            </p>
          </div>
        )}
      </div>
      <ResponsiveDialogFooter>
        <Button type="button" intent="outline" onClick={() => onOpenChange(false)} disabled={merging}>
          Отмена
        </Button>
        <Button type="button" onClick={merge} disabled={!selected || merging}>
          {merging ? 'Объединение...' : 'Объединить'}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
}
