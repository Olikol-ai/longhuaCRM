import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { isExamResultReviewed, resultStatusLabel } from '@/lib/assessment-ui';

export default function ExamCompletionScreen({
  result,
  examTitle,
  onBack,
  onOpenFeedback,
}) {
  const navigate = useNavigate();
  const kind = resultStatusLabel(result);

  let icon = <Clock3 className="h-12 w-12 text-amber-500" />;
  let title = 'Экзамен завершён';
  let subtitle = 'Спасибо за прохождение.';
  let showScore = false;

  if (kind === 'pending_review' || kind === 'processing') {
    icon = <Clock3 className="h-12 w-12 text-amber-500" />;
    title = 'Экзамен отправлен на проверку';
    subtitle =
      'Работа отправлена. Текстовые и Speaking-задания проверит преподаватель. Итоговая оценка будет после проверки.';
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
  const canOpenFeedback =
    Boolean(result?.id) && isExamResultReviewed(result);

  return (
    <div
      className="min-h-[60vh] flex items-center justify-center p-4 sm:p-8"
      data-testid="exam-completion-screen"
    >
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card shadow-lg p-6 sm:p-10 text-center space-y-5">
        <div className="flex justify-center">{icon}</div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {title}
          </h1>
          {examTitle ? (
            <p className="text-sm text-muted-foreground">{examTitle}</p>
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
            <div className="rounded-2xl bg-muted/80 p-4">
              <p className="text-xs text-muted-foreground">Балл</p>
              <p className="text-xl font-semibold text-foreground mt-1">
                {score ?? '—'}
                {maxScore != null ? (
                  <span className="text-sm font-normal text-muted-foreground"> / {maxScore}</span>
                ) : null}
              </p>
            </div>
            <div className="rounded-2xl bg-muted/80 p-4">
              <p className="text-xs text-muted-foreground">Процент</p>
              <p className="text-xl font-semibold text-foreground mt-1">
                {percent != null ? `${Number(percent).toFixed(0)}%` : '—'}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
          {canOpenFeedback && result?.id ? (
            <Button
              className="w-full sm:w-auto bg-primary hover:bg-primary/90"
              data-testid="exam-open-feedback"
              onClick={() => {
                if (onOpenFeedback) {
                  onOpenFeedback(result.id);
                  return;
                }
                navigate(
                  `${createPageUrl('StudentExamFeedback')}?resultId=${encodeURIComponent(result.id)}`,
                );
              }}
            >
              Посмотреть разбор
            </Button>
          ) : null}
          {onBack ? (
            <Button
              variant={canOpenFeedback ? 'outline' : 'default'}
              className="w-full sm:w-auto"
              onClick={onBack}
            >
              К списку экзаменов
            </Button>
          ) : (
            <Button
              asChild
              variant={canOpenFeedback ? 'outline' : 'default'}
              className="w-full sm:w-auto"
            >
              <Link to={createPageUrl('StudentExams')}>К списку экзаменов</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
