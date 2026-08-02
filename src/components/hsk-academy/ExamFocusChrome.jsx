import { Award, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Distraction-free exam chrome — CRM tokens, full viewport, no sidebar Layout.
 */
export default function ExamFocusChrome({
  title,
  sectionLabel,
  counterLabel,
  timerLabel,
  sectionTimerLabel,
  saveLabel,
  progress,
  online,
  onExit,
  headerExtra,
  children,
  footer,
}) {
  const timerUrgent = timerLabel === '00:00';
  const sectionUrgent = sectionTimerLabel === '00:00';

  return (
    <div className="h-dvh max-h-dvh bg-background text-foreground flex flex-col overflow-hidden">
      {!online ? (
        <div
          className="shrink-0 bg-amber-500/15 text-amber-950 dark:text-amber-100 border-b border-amber-500/30 px-3 py-2 text-xs sm:text-sm"
          role="status"
        >
          Нет сети. Ответы сохраняются локально и синхронизируются позже.
        </div>
      ) : null}

      <header className="shrink-0 z-30 border-b border-border bg-background">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-12 sm:h-14 min-w-0">
          <div
            className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-md bg-brand text-primary-foreground grid place-items-center"
            aria-hidden
          >
            <Award className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate leading-tight">{title || 'HSK Academy'}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate leading-tight mt-0.5">
              {[sectionLabel, counterLabel, saveLabel].filter(Boolean).join(' · ')}
            </p>
          </div>

          {sectionTimerLabel ? (
            <div
              className={cn(
                'shrink-0 hidden sm:flex flex-col items-end px-2 py-0.5 rounded-md border text-right',
                sectionUrgent
                  ? 'border-amber-500/50 text-amber-800 dark:text-amber-200 bg-amber-500/10'
                  : 'border-border text-muted-foreground bg-muted/30',
              )}
              aria-label={`Время раздела ${sectionTimerLabel}`}
            >
              <span className="text-[10px] leading-none">Раздел</span>
              <span className="font-mono text-sm tabular-nums font-semibold leading-tight">
                {sectionTimerLabel}
              </span>
            </div>
          ) : null}

          <div
            className={cn(
              'shrink-0 font-mono text-sm sm:text-base tabular-nums font-semibold px-2 py-1 rounded-md border',
              timerUrgent
                ? 'border-destructive text-destructive bg-destructive/10'
                : 'border-border text-foreground bg-muted/40',
            )}
            aria-live="polite"
            aria-label={`Всего осталось ${timerLabel}`}
          >
            {timerLabel}
          </div>

          {headerExtra}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-11 w-11 sm:h-9 sm:w-9"
            onClick={onExit}
            aria-label="Выйти"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="h-0.5 bg-muted" aria-hidden>
          <div
            className="h-full bg-brand transition-[width] duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress || 0))}%` }}
          />
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</main>

      {footer ? (
        <footer className="shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 safe-pb">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
