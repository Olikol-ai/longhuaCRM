import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/api';
import {
  AssignmentStatusBadge,
  ResultStatusBadge,
} from '@/components/assessment/StatusBadges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { useAssessmentAssignmentDetail } from '@/hooks/useAssessmentAssignments';
import {
  ASSIGNMENT_TARGET_LABEL,
  formatDateTime,
} from '@/lib/assessment-admin';

const ATTEMPT_STATUS_LABEL = {
  created: 'Создана',
  started: 'В процессе',
  submitted: 'Сдана',
};

export default function AssessmentAssignmentDetail() {
  const [params] = useSearchParams();
  const assignmentId = params.get('id') || '';
  const navigate = useNavigate();
  const {
    assignment,
    exam,
    participants,
    attempts,
    results,
    loading,
    error,
    reload,
  } = useAssessmentAssignmentDetail(assignmentId);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleCancel = async () => {
    setBusy(true);
    try {
      await api.assessment.cancelAssignment(assignmentId);
      toast({ title: 'Назначение отменено' });
      setConfirmCancel(false);
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось отменить',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!assignmentId) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <p>Не указано назначение.</p>
        <Button asChild variant="outline">
          <Link to={createPageUrl('AssessmentAssignments')}>К списку</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200">
          {error?.message || 'Назначение не найдено'}
        </div>
        <Button asChild variant="outline">
          <Link to={createPageUrl('AssessmentAssignments')}>Назад</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to={createPageUrl('AssessmentAssignments')}
            className="text-xs text-slate-500 hover:text-brand dark:hover:text-brand"
          >
            ← Назначения экзаменов
          </Link>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {exam?.name || 'Экзамен'}
            </h1>
            <AssignmentStatusBadge status={assignment.status} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {ASSIGNMENT_TARGET_LABEL[assignment.target_type] || assignment.target_type}
          </p>
        </div>
        {assignment.status !== 'cancelled' && assignment.status !== 'completed' && (
          <Button
            variant="outline"
            size="sm"
            className="text-rose-600"
            disabled={busy}
            onClick={() => setConfirmCancel(true)}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Отменить
          </Button>
        )}
      </div>

      <Card className="p-4 sm:p-5 space-y-2 text-sm">
        <p className="text-slate-600 dark:text-slate-300">
          <span className="text-slate-400">Период: </span>
          {formatDateTime(assignment.valid_from)} — {formatDateTime(assignment.valid_to)}
        </p>
        {exam?.rule && (
          <p className="text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">Правило: </span>
            {exam.rule.duration_minutes} мин · {exam.rule.max_attempts} попыт. · проходной{' '}
            {exam.rule.pass_score_percent}%
          </p>
        )}
      </Card>

      <Card className="p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">
          Назначенные пользователи ({participants.length})
        </h2>
        {participants.length === 0 ? (
          <p className="text-sm text-slate-500">Список участников пуст</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {participants.map((p) => (
              <li
                key={p.id}
                className="py-2 text-sm text-slate-800 dark:text-slate-100"
              >
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">
          Попытки ({attempts.length})
        </h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-500">Попыток ещё нет</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-2 pr-3 font-medium">№</th>
                  <th className="pb-2 pr-3 font-medium">Статус</th>
                  <th className="pb-2 pr-3 font-medium">Старт</th>
                  <th className="pb-2 font-medium">Сдача</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <td className="py-2 pr-3">{a.attempt_number}</td>
                    <td className="py-2 pr-3">
                      {ATTEMPT_STATUS_LABEL[a.status] || a.status}
                    </td>
                    <td className="py-2 pr-3">{formatDateTime(a.started_at)}</td>
                    <td className="py-2">{formatDateTime(a.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">
          Результаты ({results.length})
        </h2>
        {results.length === 0 ? (
          <p className="text-sm text-slate-500">Результатов пока нет</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-2 pr-3 font-medium">Попытка</th>
                  <th className="pb-2 pr-3 font-medium">Баллы</th>
                  <th className="pb-2 pr-3 font-medium">%</th>
                  <th className="pb-2 pr-3 font-medium">Статус</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <td className="py-2 pr-3">#{r.attempt_number}</td>
                    <td className="py-2 pr-3">
                      {r.score} / {r.max_score}
                    </td>
                    <td className="py-2 pr-3">
                      {r.percent != null ? `${Number(r.percent).toFixed(0)}%` : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <ResultStatusBadge status={r.status} />
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `${createPageUrl('AssessmentResultDetail')}?id=${encodeURIComponent(r.id)}`,
                          )
                        }
                      >
                        Открыть
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить назначение?</AlertDialogTitle>
            <AlertDialogDescription>
              Блокируется, если есть попытка в статусе started.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={handleCancel}>
              {busy ? "Отмена…" : "Отменить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
