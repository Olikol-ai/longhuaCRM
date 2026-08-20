import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Confirm finish dialog for exams / HSK / sequential attempts.
 */
export default function AttemptFinishDialog({
  open,
  answeredCount = 0,
  total = 0,
  submitting = false,
  title = 'Завершить экзамен?',
  isEarly = false,
  onContinue,
  onConfirm,
}) {
  if (!open) return null;

  const unanswered = Math.max(0, total - answeredCount);
  const body = isEarly
    ? unanswered > 0
      ? `Вы ещё не ответили на все вопросы (отвечено ${answeredCount} из ${total}). Вы действительно хотите завершить?`
      : `Вы действительно хотите завершить досрочно? Отвечено ${answeredCount} из ${total}.`
    : `Отвечено ${answeredCount} из ${total}. После отправки изменить ответы будет нельзя.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attempt-finish-title"
    >
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-card p-5 sm:p-6 space-y-4 shadow-xl safe-pb sm:pb-6">
        <h2
          id="attempt-finish-title"
          className="text-lg font-semibold text-foreground"
        >
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onContinue} disabled={submitting}>
            Продолжить выполнение
          </Button>
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90"
            disabled={submitting}
            onClick={onConfirm}
            data-testid="attempt-finish-confirm"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Отправка…
              </>
            ) : (
              'Да, завершить'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
