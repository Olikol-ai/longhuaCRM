import { cn } from '@/lib/utils';
import { linkQualityMeta } from '@/lib/lesson-video';

/**
 * Compact traffic-light for local (or peer) WebRTC link quality.
 */
export default function LessonVideoLinkQuality({
  quality = 'unknown',
  className,
  showLabel = true,
  compact = false,
}) {
  const meta = linkQualityMeta(quality);
  const tone =
    meta.tone === 'ok'
      ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300'
      : meta.tone === 'warn'
        ? 'bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-200'
        : meta.tone === 'bad'
          ? 'bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300'
          : 'bg-muted text-muted-foreground ring-border';
  const dot =
    meta.tone === 'ok'
      ? 'bg-emerald-500'
      : meta.tone === 'warn'
        ? 'bg-amber-500'
        : meta.tone === 'bad'
          ? 'bg-rose-500 animate-pulse'
          : 'bg-muted-foreground';

  return (
    <span
      className={cn(
        'inline-flex h-7 max-w-[10.5rem] items-center gap-1.5 truncate rounded-full px-2 text-[11px] font-medium ring-1',
        tone,
        className,
      )}
      title={meta.hint}
      aria-label={`Качество связи: ${meta.label}. ${meta.hint}`}
      data-testid="lesson-video-link-quality"
      data-quality={meta.id}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden />
      {showLabel ? (
        <span className="truncate">{compact ? meta.shortLabel : meta.label}</span>
      ) : null}
    </span>
  );
}
