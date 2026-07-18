import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { resultStatusLabel } from '@/lib/assessment-ui';

export default function ExamCompletionScreen({ result, examTitle, onBack }) {
  const kind = resultStatusLabel(result);

  let icon = <Clock3 className="h-12 w-12 text-amber-500" />;
  let title = 'Экзамен завершён';
  let subtitle = 'Спасибо за прохождение.';
  let showScore = false;

  if (kind === 'pending_review' || kind === 'processing') {
    icon = <Clock3 className="h-12 w-12 text-amber-500" />;
    subtitle = 'Результат ожидает проверки';
  } else if (kind === 'passed') {
    icon = <CheckCircle2 className="h-12 w-12 text-emerald-500" />;
    subtitle = 'Сдан';
    showScore = true;
  } else if (kind === 'failed') {
    icon = <XCircle className="h-12 w-12 text-rose-500" />;
    subtitle = 'Не сдан';
    showScore = true;
  } else if (!result) {
    subtitle = 'Результат скоро появится в разделе «Мои экзамены».';
  }

  const score = result?.score;
  const maxScore = result?.max_score;
  const percent = result?.percent;

  return (
    <div
      className="min-h-[60vh] flex items-center justify-center p-4 sm:p-8"
      data-testid="exam-completion-screen"
    >
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-6 sm:p-10 text-center space-y-5">
        <div className="flex justify-center">{icon}</div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {title}
          </h1>
          {examTitle ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{examTitle}</p>
          ) : null}
          <p
            className={`text-lg font-medium ${
              kind === 'passed'
                ? 'text-emerald-600 dark:text-emerald-400'
                : kind === 'failed'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {subtitle}
          </p>
        </div>

        {showScore && (
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Балл</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                {score ?? '—'}
                {maxScore != null ? (
                  <span className="text-sm font-normal text-slate-400"> / {maxScore}</span>
                ) : null}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Процент</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                {percent != null ? `${Number(percent).toFixed(0)}%` : '—'}
              </p>
            </div>
          </div>
        )}

        <div className="pt-2">
          {onBack ? (
            <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700" onClick={onBack}>
              К списку экзаменов
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
              <Link to={createPageUrl('StudentExams')}>К списку экзаменов</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
