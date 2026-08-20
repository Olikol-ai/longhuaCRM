import { Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Local share “thumbnail” cue — External API cannot expose the captured
 * MediaStream cross-origin, so we show a clear status card instead of a fake preview.
 */
export default function LessonVideoSharePreview({
  visible,
  shareLabel = 'экран',
  className,
}) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-24 left-3 z-20 w-[7.5rem] overflow-hidden rounded-xl border border-amber-500/50 bg-card/95 shadow-lg backdrop-blur-md sm:bottom-28 sm:left-4 sm:w-36',
        className,
      )}
      data-testid="lesson-video-share-preview"
      aria-label={`Демонстрация: ${shareLabel}`}
    >
      <div className="flex aspect-video flex-col items-center justify-center gap-1 bg-gradient-to-br from-amber-500/20 to-muted p-2">
        <Monitor className="h-7 w-7 text-amber-700 dark:text-amber-300" aria-hidden />
        <span className="line-clamp-2 px-1 text-center text-[10px] font-semibold leading-tight text-foreground">
          {shareLabel}
        </span>
      </div>
      <div className="border-t border-border px-2 py-1 text-[9px] font-medium text-muted-foreground">
        Видят ученики
      </div>
    </div>
  );
}
