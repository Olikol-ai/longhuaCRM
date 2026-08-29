import { Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  EXAM_UI_STATUS,
  EXAM_UI_STATUS_LABEL,
  isExamResultReviewed,
} from '@/lib/assessment-ui';

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_STYLES = {
  [EXAM_UI_STATUS.NOT_STARTED]:
    'bg-muted text-foreground dark:bg-slate-800 dark:text-muted-foreground',
  [EXAM_UI_STATUS.IN_PROGRESS]:
    'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  [EXAM_UI_STATUS.COMPLETED]:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
};

export default function ExamAssignmentCard({
  card,
  onStart,
  onContinue,
  onViewResult,
  busy = false,
}) {
  const deadline = formatDate(card.deadline);
  const statusLabel = EXAM_UI_STATUS_LABEL[card.status] || 'Статус неизвестен';
  const durationMinutes =
    card.durationMinutes ??
    card.exam?.rule?.duration_minutes ??
    card.exam?.rule?.durationMinutes ??
    null;
  const reviewed = isExamResultReviewed(card.result);

  return (
    <article
      className="rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-card/80 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
      data-testid="exam-assignment-card"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {card.title}
            </h2>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[card.status] || STATUS_STYLES[EXAM_UI_STATUS.NOT_STARTED]}`}
            >
              {statusLabel}
            </span>
          </div>
          {card.description ? (
            <p
              className="text-sm text-muted-foreground whitespace-pre-wrap"
              data-testid="exam-card-description"
            >
              {card.description}
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5 text-xs sm:text-sm text-muted-foreground pt-1">
            {deadline && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                Сдать до: {deadline}
              </span>
            )}
            {durationMinutes != null && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {durationMinutes} минут
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2 shrink-0 w-full sm:w-auto min-w-0">
          {card.status === EXAM_UI_STATUS.NOT_STARTED && (
            <Button
              className="w-full sm:w-auto bg-primary hover:bg-primary/90"
              disabled={busy}
              onClick={() => onStart?.(card)}
              data-testid="exam-start-button"
            >
              Начать экзамен
            </Button>
          )}
          {card.status === EXAM_UI_STATUS.IN_PROGRESS && (
            <Button
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
              disabled={busy}
              onClick={() => onContinue?.(card)}
            >
              Продолжить
            </Button>
          )}
          {card.status === EXAM_UI_STATUS.COMPLETED && reviewed && (
            <Button
              variant="outline"
              className="w-full sm:w-auto max-w-full"
              disabled={busy}
              onClick={() => onViewResult?.(card)}
              data-testid="exam-view-feedback-button"
            >
              Посмотреть разбор
            </Button>
          )}
          {card.status === EXAM_UI_STATUS.COMPLETED && !reviewed && (
            <Button
              variant="outline"
              className="w-full sm:w-auto max-w-full"
              disabled
              data-testid="exam-pending-review-button"
            >
              Ожидает проверки
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
