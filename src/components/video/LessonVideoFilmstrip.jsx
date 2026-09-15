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
 * Bottom-right teacher camera chrome while screen share fills the stage.
 * Real video stays in the Jitsi filmstrip (styled via plugin.head.html);
 * this CRM tile is a pin/fallback control, not a second media connection.
 */
export default function LessonVideoFilmstrip({
  visible = false,
  participants = [],
  pinnedId = null,
  onSelect,
  onPin,
  compact = true,
  /** Prefer showing the screen-sharer's camera identity (teacher). */
  preferScreenSharer = true,
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
    if (online.length === 0) return [];

    if (preferScreenSharer) {
      const sharer = online.find((p) => p.screenSharing);
      // Show camera identity for the person sharing (not a roster of everyone).
      if (sharer) return [sharer];
    }

    const sorted = [...online].sort((a, b) => {
      const aShare = a.screenSharing ? 1 : 0;
      const bShare = b.screenSharing ? 1 : 0;
      if (aShare !== bShare) return aShare - bShare;
      return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'ru');
    });
    // At most one PiP tile — avoid a permanent participants strip.
    return sorted.slice(0, 1);
  }, [participants, preferScreenSharer]);

  if (!visible || list.length === 0) return null;

  const landscape = orientation === 'landscape';

  return (
    <div
      className={cn(
        'pointer-events-none absolute z-[25] flex gap-2',
        // Bottom-right over screen share (above dock safe area).
        'bottom-[5.75rem] right-2 sm:bottom-[6.5rem] sm:right-3',
        landscape ? 'flex-col' : 'flex-col',
      )}
      data-testid="lesson-video-filmstrip"
      data-orientation={orientation}
      role="list"
      aria-label="Камера преподавателя"
    >
      {list.map((p) => {
        const isPinned = pinnedId && pinnedId === p.id;
        const label = p.displayName || 'Преподаватель';
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
                ? 'h-[5.5rem] w-[7.25rem] sm:h-[6.5rem] sm:w-[8.5rem]'
                : 'h-28 w-36 sm:h-32 sm:w-40',
            )}
          >
            <button
              type="button"
              className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70"
              onClick={() => onSelect?.(p.id, label)}
              aria-label={`Камера: ${label}`}
              data-testid={`lesson-video-thumb-${p.id}`}
            >
              <span
                className={cn(
                  'flex items-center justify-center rounded-full bg-brand/90 font-semibold text-white',
                  compact ? 'h-9 w-9 text-[11px]' : 'h-11 w-11 text-xs',
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
