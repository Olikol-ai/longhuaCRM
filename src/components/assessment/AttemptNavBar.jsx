import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Unified attempt navigation: Next is primary until the last question,
 * then Finish becomes primary. Early finish stays available but de-emphasized.
 */
export default function AttemptNavBar({
  index = 0,
  total = 0,
  submitting = false,
  finishLabel = 'Завершить экзамен',
  earlyFinishLabel = 'Завершить',
  onPrev,
  onNext,
  onFinish,
  onRequestEarlyFinish,
  extraActions = null,
  className,
}) {
  const isLast = total > 0 && index >= total - 1;
  const canPrev = index > 0;
  const canNext = !isLast && index < total - 1;

  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!isLast ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground order-last sm:order-first min-h-11 px-3"
            disabled={submitting}
            onClick={onRequestEarlyFinish}
            data-testid="attempt-early-finish"
          >
            {earlyFinishLabel}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          disabled={!canPrev || submitting}
          onClick={onPrev}
          className="min-h-11 flex-1 sm:flex-none"
          data-testid="attempt-prev"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Предыдущий
        </Button>

        {extraActions}
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        {isLast ? (
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90 min-h-11 w-full sm:w-auto sm:min-w-[11rem]"
            disabled={submitting}
            onClick={onFinish}
            data-testid="attempt-finish"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Отправка…
              </>
            ) : (
              finishLabel
            )}
          </Button>
        ) : (
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90 min-h-11 w-full sm:w-auto sm:min-w-[10rem]"
            disabled={!canNext || submitting}
            onClick={onNext}
            data-testid="attempt-next"
          >
            Следующий
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
