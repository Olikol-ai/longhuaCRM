import { Link } from 'react-router-dom';
import { Award } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Distraction-free exam chrome — CRM tokens, no sidebar Layout.
 */
export default function ExamFocusChrome({
  title,
  meta,
  timerLabel,
  saveLabel,
  progress,
  online,
  onExit,
  children,
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {!online ? (
        <div
          className="bg-amber-500/15 text-amber-900 dark:text-amber-100 border-b border-amber-500/30 px-4 py-2 text-sm"
          role="status"
        >
          Нет интернета. Ответы сохраняются локально и синхронизируются при восстановлении сети.
        </div>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={createPageUrl('HskAcademy')}
              className="h-9 w-9 shrink-0 rounded-md bg-brand text-primary-foreground grid place-items-center"
              aria-label="HSK Academy"
            >
              <Award className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="font-medium truncate">{title || 'HSK Academy'}</p>
              {meta ? (
                <p className="text-xs text-muted-foreground truncate">{meta}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'font-mono text-sm tabular-nums min-h-11 px-3',
                timerLabel === '00:00' && 'border-destructive text-destructive',
              )}
              aria-live="polite"
            >
              {timerLabel}
            </Badge>
            {saveLabel ? (
              <span className="text-xs text-muted-foreground hidden sm:inline">{saveLabel}</span>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onExit}>
              Выйти
            </Button>
          </div>
        </div>
        <div className="h-1 bg-muted" aria-hidden>
          <div
            className="h-full bg-brand transition-[width] duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress || 0))}%` }}
          />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
