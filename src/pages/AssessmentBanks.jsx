import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { api } from '@/api';
import BankFormDialog from '@/components/assessment/BankFormDialog';
import LifecycleBadge from '@/components/assessment/LifecycleBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { useAssessmentBanks } from '@/hooks/useAssessmentBanks';
import { formatDateTime } from '@/lib/assessment-admin';

export default function AssessmentBanks() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const { banks, loading, error, reload } = useAssessmentBanks({
    status: statusFilter,
    search: searchApplied,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const sorted = useMemo(
    () =>
      [...banks].sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'ru'),
      ),
    [banks],
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (bank) => {
    if (bank.status !== 'draft') {
      toast({
        title: 'Редактирование недоступно',
        description: 'Изменять можно только банки в статусе «Черновик».',
        variant: 'destructive',
      });
      return;
    }
    setEditing(bank);
    setDialogOpen(true);
  };

  const handleSubmit = async (payload) => {
    if (editing) {
      await api.assessment.updateBank(editing.id, payload);
      toast({ title: 'Банк обновлён' });
    } else {
      await api.assessment.createBank(payload);
      toast({ title: 'Банк создан' });
    }
    reload();
  };

  const handlePublish = async (bank) => {
    setBusyId(bank.id);
    try {
      await api.assessment.publishBank(bank.id);
      toast({ title: 'Банк опубликован' });
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось опубликовать',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleArchive = async () => {
    const bank = confirmArchive;
    if (!bank) return;
    setBusyId(bank.id);
    try {
      await api.assessment.archiveBank(bank.id);
      toast({ title: 'Банк архивирован' });
      setConfirmArchive(null);
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось архивировать',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to={createPageUrl('AdminAssessment')}
            className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            ← Экзамены
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Банки вопросов
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Создание и управление банками (только администратор)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Создать банк
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Поиск по названию…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearchApplied(search.trim());
            }}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-44"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="published">Опубликован</option>
          <option value="archived">В архиве</option>
        </select>
        <Button variant="outline" onClick={() => setSearchApplied(search.trim())}>
          Найти
        </Button>
      </div>

      {error && (
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <p className="font-medium">Ошибка загрузки</p>
          <p className="mt-1">{error.message}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center space-y-3">
          <Archive className="h-10 w-10 mx-auto text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Банков пока нет
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Создайте первый банк вопросов, чтобы начать наполнять базу.
          </p>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Создать банк
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((bank) => (
            <article
              key={bank.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                      {bank.name}
                    </h2>
                    <LifecycleBadge status={bank.status} />
                  </div>
                  {bank.description ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                      {bank.description}
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-400">
                    {bank.locale ? `Локаль: ${bank.locale} · ` : ''}
                    Обновлён: {formatDateTime(bank.updated_at || bank.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {bank.status === 'draft' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === bank.id}
                        onClick={() => openEdit(bank)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Изменить
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === bank.id}
                        onClick={() => handlePublish(bank)}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Опубликовать
                      </Button>
                    </>
                  )}
                  {bank.status !== 'archived' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                      disabled={busyId === bank.id}
                      onClick={() => setConfirmArchive(bank)}
                    >
                      <Archive className="h-3.5 w-3.5 mr-1" />
                      В архив
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <BankFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={editing ? 'edit' : 'create'}
        bank={editing}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={Boolean(confirmArchive)}
        onOpenChange={(open) => !open && setConfirmArchive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать банк?</AlertDialogTitle>
            <AlertDialogDescription>
              Банк «{confirmArchive?.name}» будет переведён в архив. Это действие
              стоит подтвердить осознанно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={!!busyId} onClick={handleArchive}>
              {busyId ? "Архивирование…" : "Архивировать"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
