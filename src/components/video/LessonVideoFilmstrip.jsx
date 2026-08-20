import { useEffect, useMemo, useState } from 'react';
import { Mic, MicOff, Pin, Video, VideoOff, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

function initials(name) {
  const parts = String(name || '')
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

/**
 * Zoom-like participant thumbnails over the stage while someone shares a screen.
 * Pins via External API (real video stays in the Jitsi stage/filmstrip iframe).
 */
export default function LessonVideoFilmstrip({
  visible = false,
  participants = [],
  pinnedId = null,
  onSelect,
  onPin,
  compact = true,
}) {
  const [orientation, setOrientation] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches
      ? 'landscape'
      : 'portrait',
  );

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const sync = () => setOrientation(mq.matches ? 'landscape' : 'portrait');
    sync();
    mq.addEventListener?.('change', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      mq.removeEventListener?.('change', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  const list = useMemo(() => {
    const online = (participants || []).filter((p) => p?.online && p?.id);
    // Prefer non-sharers in the strip (share already fills the stage).
    const sorted = [...online].sort((a, b) => {
      const aShare = a.screenSharing ? 1 : 0;
      const bShare = b.screenSharing ? 1 : 0;
      if (aShare !== bShare) return aShare - bShare;
      return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'ru');
    });
    return sorted;
  }, [participants]);

  if (!visible || list.length === 0) return null;

  const landscape = orientation === 'landscape';

  return (
    <div
      className={cn(
        'pointer-events-none absolute z-[25] flex gap-2',
        landscape
          ? 'right-2 top-2 max-h-[min(70%,22rem)] flex-col overflow-y-auto overflow-x-hidden pr-0.5'
          : 'right-2 top-2 max-w-[calc(100%-1rem)] flex-row overflow-x-auto overflow-y-hidden pb-0.5',
      )}
      data-testid="lesson-video-filmstrip"
      data-orientation={orientation}
      role="list"
      aria-label="Участники"
    >
      {list.map((p) => {
        const isPinned = pinnedId && pinnedId === p.id;
        const label = p.displayName || 'Участник';
        const videoOff = p.videoMuted !== false && p.videoMuted !== null ? p.videoMuted : false;
        const audioOff = Boolean(p.audioMuted);
        return (
          <div
            key={p.id}
            role="listitem"
            className={cn(
              'pointer-events-auto relative shrink-0 overflow-hidden rounded-xl border shadow-lg backdrop-blur-md transition',
              'border-white/25 bg-black/55 text-white',
              isPinned && 'ring-2 ring-brand ring-offset-1 ring-offset-black/40',
              compact
                ? landscape
                  ? 'h-[4.75rem] w-[5.5rem]'
                  : 'h-[4.25rem] w-[5.25rem]'
                : landscape
                  ? 'h-28 w-36'
                  : 'h-24 w-32',
            )}
          >
            <button
              type="button"
              className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70"
              onClick={() => onSelect?.(p.id, label)}
              aria-label={`Показать ${label}`}
              data-testid={`lesson-video-thumb-${p.id}`}
            >
              <span
                className={cn(
                  'flex items-center justify-center rounded-full bg-brand/90 font-semibold text-white',
                  compact ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs',
                )}
                aria-hidden
              >
                {initials(label)}
              </span>
              <span className="line-clamp-1 w-full px-0.5 text-[10px] font-medium leading-tight">
                {label}
              </span>
            </button>

            <div className="pointer-events-none absolute left-1 top-1 flex items-center gap-0.5">
              {p.screenSharing ? (
                <span className="rounded bg-amber-500/95 p-0.5 text-white" title="Демонстрация">
                  <Monitor className="h-2.5 w-2.5" />
                </span>
              ) : null}
              {audioOff ? (
                <span className="rounded bg-rose-500/90 p-0.5">
                  <MicOff className="h-2.5 w-2.5" />
                </span>
              ) : (
                <span className="rounded bg-black/50 p-0.5 opacity-70">
                  <Mic className="h-2.5 w-2.5" />
                </span>
              )}
              {videoOff ? (
                <span className="rounded bg-black/50 p-0.5 opacity-70">
                  <VideoOff className="h-2.5 w-2.5" />
                </span>
              ) : (
                <span className="rounded bg-black/50 p-0.5 opacity-70">
                  <Video className="h-2.5 w-2.5" />
                </span>
              )}
            </div>

            <button
              type="button"
              className={cn(
                'absolute bottom-1 right-1 rounded-md p-1 transition',
                isPinned
                  ? 'bg-brand text-white'
                  : 'bg-black/55 text-white/90 hover:bg-black/75',
              )}
              aria-label={isPinned ? 'Открепить' : 'Закрепить'}
              data-testid={`lesson-video-pin-${p.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onPin?.(p.id, label);
              }}
            >
              <Pin className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
