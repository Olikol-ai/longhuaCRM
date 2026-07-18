import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Target,
  XCircle,
} from 'lucide-react';
import { api } from '@/api';
import AssignmentCreateDialog from '@/components/assessment/AssignmentCreateDialog';
import { AssignmentStatusBadge } from '@/components/assessment/StatusBadges';
import { Button } from '@/components/ui/button';
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
import { useAssessmentAssignments } from '@/hooks/useAssessmentAssignments';
import {
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_TARGET_LABEL,
  formatDateTime,
} from '@/lib/assessment-admin';

export default function AssessmentAssignments() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const { assignments, loading, error, reload } = useAssessmentAssignments({
    status: statusFilter,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const goDetail = (id) => {
    navigate(
      `${createPageUrl('AssessmentAssignmentDetail')}?id=${encodeURIComponent(id)}`,
    );
  };

  const handleCancel = async () => {
    if (!confirmCancel) return;
    setBusyId(confirmCancel.id);
    try {
      await api.assessment.cancelAssignment(confirmCancel.id);
      toast({ title: 'Назначение отменено' });
      setConfirmCancel(null);
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось отменить',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to={createPageUrl('AdminAssessment')}
            className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            ← Экзамены
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Назначения экзаменов
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Выдача экзаменов ученикам, группам и курсам
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Создать назначение
          </Button>
        </div>
      </div>

      <select
        className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-52"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="">Все статусы</option>
        {Object.entries(ASSIGNMENT_STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

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
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center space-y-3">
          <Target className="h-10 w-10 mx-auto text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Назначений пока нет
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Назначьте опубликованный экзамен ученику или группе.
          </p>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Создать назначение
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                      {row.exam_name}
                    </h2>
                    <AssignmentStatusBadge status={row.status} />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {ASSIGNMENT_TARGET_LABEL[row.target_type] || row.target_type}:{' '}
                    {row.target_label}
                  </p>
                  <p className="text-xs text-slate-400">
                    С {formatDateTime(row.valid_from)} · до{' '}
                    {formatDateTime(row.valid_to)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => goDetail(row.id)}>
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Открыть
                  </Button>
                  {row.status !== 'cancelled' && row.status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600"
                      disabled={busyId === row.id}
                      onClick={() => setConfirmCancel(row)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Отменить
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AssignmentCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(created) => {
          toast({ title: 'Назначение создано' });
          goDetail(created.id);
        }}
      />

      <AlertDialog
        open={Boolean(confirmCancel)}
        onOpenChange={(o) => !o && setConfirmCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить назначение?</AlertDialogTitle>
            <AlertDialogDescription>
              Нельзя отменить, если уже есть попытка в статусе «В процессе» (started).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction disabled={!!busyId} onClick={handleCancel}>
              {busyId ? "Отмена…" : "Отменить назначение"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
