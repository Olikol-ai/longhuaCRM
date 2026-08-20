import { Mic, MicOff, Video, VideoOff, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { linkQualityMeta } from '@/lib/lesson-video';

function StatusIcon({ active, onIcon: On, offIcon: Off, labelOn, labelOff }) {
  const Icon = active === false ? Off : On;
  const muted = active === false;
  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-md',
        muted
          ? 'bg-muted text-muted-foreground'
          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      )}
      title={muted ? labelOff : labelOn}
      aria-label={muted ? labelOff : labelOn}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

/**
 * Mic / camera / screen-share / link-quality chips for a roster row.
 */
export default function LessonVideoParticipantDevices({
  online = false,
  audioMuted = null,
  videoMuted = null,
  screenSharing = false,
  linkQuality = null,
  className,
}) {
  if (!online) {
    return (
      <span className={cn('text-[10px] text-muted-foreground', className)}>офлайн</span>
    );
  }

  const quality = linkQuality ? linkQualityMeta(linkQuality) : null;
  const qDot =
    quality?.tone === 'ok'
      ? 'bg-emerald-500'
      : quality?.tone === 'warn'
        ? 'bg-amber-500'
        : quality?.tone === 'bad'
          ? 'bg-rose-500'
          : 'bg-muted-foreground/50';

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1', className)}
      data-testid="lesson-video-participant-devices"
    >
      <StatusIcon
        active={audioMuted === null ? true : !audioMuted}
        onIcon={Mic}
        offIcon={MicOff}
        labelOn="Микрофон включён"
        labelOff="Микрофон выключен"
      />
      <StatusIcon
        active={videoMuted === null ? true : !videoMuted}
        onIcon={Video}
        offIcon={VideoOff}
        labelOn="Камера включена"
        labelOff="Камера выключена"
      />
      {screenSharing ? (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200"
          title="Демонстрирует экран"
          aria-label="Демонстрирует экран"
        >
          <Monitor className="h-3.5 w-3.5" aria-hidden />
        </span>
      ) : null}
      {quality ? (
        <span
          className="inline-flex h-6 items-center gap-1 rounded-md bg-muted px-1.5 text-[10px] text-muted-foreground"
          title={`Связь: ${quality.label}. ${quality.hint}`}
          aria-label={`Качество связи: ${quality.label}`}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', qDot)} aria-hidden />
          {quality.shortLabel}
        </span>
      ) : null}
    </div>
  );
}
