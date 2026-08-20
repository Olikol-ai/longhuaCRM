import { cn } from '@/lib/utils';

const MODE_LABEL = {
  online: 'Онлайн',
  recovering: 'Восстанавливается',
  degraded: 'Нет связи с сервером',
  offline: 'Офлайн',
};

const MODE_DOT = {
  online: 'bg-emerald-500',
  recovering: 'bg-amber-400',
  degraded: 'bg-amber-500',
  offline: 'bg-red-500',
};

/**
 * Unified offline / network status strip (Design System).
 * Compact on mobile; thin strip on desktop. Does not cover video / PiP / bottom nav.
 *
 * @param {{
 *   mode?: 'online'|'recovering'|'degraded'|'offline',
 *   detail?: string | null,
 *   className?: string,
 *   compact?: boolean,
 * }} props
 */
export function OfflineStatus({
  mode = 'online',
  detail = null,
  className,
  compact = false,
}) {
  if (mode === 'online' && !detail) return null;

  const label = MODE_LABEL[mode] || MODE_LABEL.offline;
  const dot = MODE_DOT[mode] || MODE_DOT.offline;

  return (
    <div
      role="status"
      data-testid="offline-status"
      data-mode={mode}
      className={cn(
        'pointer-events-none z-[60] w-full border-b border-border/60 bg-card/95 text-foreground backdrop-blur-sm',
        compact ? 'px-3 py-1.5' : 'px-4 py-1.5',
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 text-xs sm:text-sm">
        <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden />
        <span className="font-medium">{label}</span>
        {detail ? (
          <span className="truncate text-muted-foreground">{detail}</span>
        ) : null}
      </div>
    </div>
  );
}
