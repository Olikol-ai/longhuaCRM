import { useEffect, useState } from 'react';
import { MonitorOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Zoom-like share strip — local “you are sharing” controls or remote “teacher sharing” status.
 */
export default function LessonVideoScreenShareBar({
  visible,
  shareLabel = 'экран',
  startedAt = null,
  isLocalShare = true,
  onStopShare,
  onChangeSource,
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible || !startedAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [visible, startedAt]);

  if (!visible) return null;

  const elapsed = startedAt ? formatElapsed(now - startedAt) : '00:00';

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-2 pt-2"
      data-testid="lesson-video-screenshare-bar"
    >
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-md">
        <span
          className={cn(
            'inline-flex max-w-[min(100%,16rem)] items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:text-amber-100',
          )}
        >
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
          <span className="truncate">
            {isLocalShare
              ? `Вы демонстрируете ${shareLabel}`
              : 'Демонстрация экрана'}
          </span>
        </span>

        <span
          className="tabular-nums text-xs font-medium text-muted-foreground"
          data-testid="lesson-video-share-timer"
        >
          {elapsed}
        </span>

        {isLocalShare && onStopShare ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="min-h-10"
            onClick={onStopShare}
            data-testid="lesson-video-stop-share"
          >
            <MonitorOff className="mr-1.5 h-4 w-4" />
            Остановить
          </Button>
        ) : null}

        {isLocalShare && onChangeSource ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10"
            onClick={onChangeSource}
            data-testid="lesson-video-change-share"
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Сменить источник
          </Button>
        ) : null}
      </div>
    </div>
  );
}
