import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ResultStatusBadge } from '@/components/assessment/StatusBadges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createPageUrl } from '@/utils';
import { useAssessmentResultDetail } from '@/hooks/useAssessmentResults';
import {
  EVALUATION_TYPE_LABEL,
  formatDateTime,
  formatDurationSeconds,
} from '@/lib/assessment-admin';

export default function AssessmentResultDetail() {
  const [params] = useSearchParams();
  const resultId = params.get('id') || '';
  const { result, exam, studentName, loading, error } =
    useAssessmentResultDetail(resultId);

  if (!resultId) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <p>Не указан результат.</p>
        <Button asChild variant="outline">
          <Link to={createPageUrl('AssessmentResults')}>К списку</Link>
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

  if (error || !result) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200">
          {error?.message || 'Результат не найден'}
        </div>
        <Button asChild variant="outline">
          <Link to={createPageUrl('AssessmentResults')}>Назад</Link>
        </Button>
      </div>
    );
  }

  const breakdowns = result.breakdowns || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 pb-16">
      <div>
        <Link
          to={createPageUrl('AssessmentResults')}
          className="text-xs text-slate-500 hover:text-brand dark:hover:text-brand"
        >
          ← Результаты
        </Link>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {exam?.name || 'Результат экзамена'}
          </h1>
          <ResultStatusBadge status={result.status} />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {studentName} · попытка #{result.attempt_number}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Балл</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
            {result.score}
            <span className="text-sm font-normal text-slate-400">
              {' '}
              / {result.max_score}
            </span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Процент</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
            {result.percent != null ? `${Number(result.percent).toFixed(0)}%` : '—'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Длительность</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
            {formatDurationSeconds(result.duration)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Оценка</p>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-1.5">
            {EVALUATION_TYPE_LABEL[result.evaluation_type] ||
              result.evaluation_type ||
              '—'}
          </p>
        </Card>
      </div>

      <Card className="p-4 sm:p-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p>
          <span className="text-slate-400">Начало: </span>
          {formatDateTime(result.started_at)}
        </p>
        <p>
          <span className="text-slate-400">Окончание: </span>
          {formatDateTime(result.finished_at)}
        </p>
      </Card>

      <Card className="p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">
          Разбивка по секциям
        </h2>
        {breakdowns.length === 0 ? (
          <p className="text-sm text-slate-500">
            Детализация по секциям недоступна для этого результата
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-2 pr-3 font-medium">Секция</th>
                  <th className="pb-2 pr-3 font-medium">Вес</th>
                  <th className="pb-2 pr-3 font-medium">Балл</th>
                  <th className="pb-2 font-medium">Макс. балл</th>
                </tr>
              </thead>
              <tbody>
                {breakdowns.map((b) => (
                  <tr
                    key={b.id || b.section_key}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <td className="py-2.5 pr-3 font-medium text-slate-800 dark:text-slate-100">
                      {b.section_key}
                    </td>
                    <td className="py-2.5 pr-3">{b.weight}%</td>
                    <td className="py-2.5 pr-3">{b.score}</td>
                    <td className="py-2.5">{b.max_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
