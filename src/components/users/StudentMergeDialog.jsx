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

/**
 * Primary student is ALWAYS the account opened via «Объединить»
 * (`user.student_profile_id`). The selected candidate is secondary (absorbed).
 */
export default function StudentMergeDialog({ user, open, onOpenChange, onMerged }) {
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);

  const primaryStudentId = user?.student_profile_id;
  const primaryLabel = user?.full_name || user?.email || 'Основной аккаунт';

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
    // Freeze primary at click-time account — never swap based on heuristics.
    const lockedPrimaryId = primaryStudentId;
    const lockedSecondaryId = selected.id;
    setMerging(true);
    try {
      await api.students.merge(lockedPrimaryId, lockedSecondaryId);
      toast({
        title: 'Ученики объединены',
        description: `Данные перенесены в «${primaryLabel}». Расписание занятий не изменялось.`,
      });
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
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/20 dark:border-emerald-900 p-3"
          data-testid="merge-primary-card"
        >
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200 mb-1">
            Основной аккаунт (останется)
          </p>
          <p className="font-semibold">{primaryLabel}</p>
          <p className="text-sm text-muted-foreground">{user.email || '—'}</p>
          <p className="text-sm mt-2">Баланс: {formatBalance(primaryBalance)}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Это аккаунт, у которого вы нажали «Объединить». Его занятия и ID сохраняются.
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-muted-foreground">Присоединить профиль</span>
          <Input
            className="mt-1"
            placeholder="Поиск ученика..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="merge-search"
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
              data-testid={`merge-candidate-${candidate.id}`}
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
                {candidate.account_status === 'active_account' ? ' · Есть аккаунт' : ' · Без аккаунта'}
                {candidate.group_names?.length ? ` · Группы: ${candidate.group_names.join(', ')}` : ''}
              </p>
            </button>
          ))}
        </div>

        {selected && (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-sm space-y-2"
            data-testid="merge-confirm-summary"
          >
            <p className="font-medium text-amber-900 dark:text-amber-200">Перед подтверждением</p>
            <p>
              <span className="text-muted-foreground">Основной аккаунт: </span>
              <b>{primaryLabel}</b>
            </p>
            <p>
              <span className="text-muted-foreground">Присоединяемый аккаунт: </span>
              <b>{selected.full_name}</b>
              {selected.email ? ` (${selected.email})` : ''}
            </p>
            <p className="text-muted-foreground">
              Баланс основного: {formatBalance(primaryBalance)}
            </p>
            <p className="text-muted-foreground">
              Баланс присоединяемого: {formatBalance(secondaryBalance)}
            </p>
            <p className="font-semibold">
              Итоговый баланс: {formatBalance(resultingBalance)}
            </p>
            <p className="text-xs text-muted-foreground">
              Данные присоединяемого профиля будут перенесены в основной. Дата, время и повторение
              существующих занятий не изменяются. Присоединённый профиль будет деактивирован.
            </p>
          </div>
        )}
      </div>
      <ResponsiveDialogFooter>
        <Button type="button" intent="outline" onClick={() => onOpenChange(false)} disabled={merging}>
          Отмена
        </Button>
        <Button
          type="button"
          onClick={merge}
          disabled={!selected || merging}
          data-testid="merge-confirm"
        >
          {merging ? 'Объединение...' : 'Подтвердить объединение'}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
}
