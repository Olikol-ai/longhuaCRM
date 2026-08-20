import { Loader2, Pause, Play, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useId, useMemo } from 'react';
import { Button, IconButton } from '@/design-system';
import { iconSize } from '@/design-system/tokens/icon';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import {
  PLAYBACK_SPEEDS,
  barsFromId,
  formatAudioClock,
  isFiniteDuration,
} from '@/lib/audio/audioPlayerUtils';
import { cn } from '@/lib/utils';

const LOAD_ERROR_MESSAGE =
  'Не удалось загрузить аудиозапись. Попробуйте обновить страницу или повторить попытку позже.';

/**
 * Longhua Design System audio player — single engine for learning + voice.
 *
 * variant: default | material | homework | compact | voice
 *
 * Hidden <audio class="lh-audio-engine"> — never native controls as primary UI.
 */
export default function LonghuaAudioPlayer({
  src,
  variant = 'default',
  className,
  wrapperClassName,
  preload = 'metadata',
  durationHintMs = null,
  waveformSeed = null,
  own = false,
  emptyLabel = 'Аудиофайл недоступен.',
  onPlayingChange,
}) {
  const reactId = useId();
  const isVoice = variant === 'voice';
  const player = useAudioPlayer({ src, playbackRates: PLAYBACK_SPEEDS });
  const bars = useMemo(
    () => barsFromId(waveformSeed || src || reactId, isVoice ? 36 : 48),
    [waveformSeed, src, reactId, isVoice],
  );
  const hintSec =
    durationHintMs != null && Number(durationHintMs) > 0
      ? Number(durationHintMs) / 1000
      : 0;
  const shownDuration = isFiniteDuration(player.durationSec)
    ? player.durationSec
    : hintSec;
  const clockCurrent = formatAudioClock(player.currentSec);
  const clockDuration = formatAudioClock(shownDuration);

  useEffect(() => {
    onPlayingChange?.(player.playing);
  }, [player.playing, onPlayingChange]);

  if (!src) {
    return (
      <p
        className={cn('text-sm text-muted-foreground', wrapperClassName)}
        data-testid="crm-audio-player-empty"
      >
        {emptyLabel}
      </p>
    );
  }

  if (player.failed) {
    return (
      <div
        className={cn(
          'crm-audio-player lh-audio w-full max-w-full rounded-xl border border-destructive/30',
          'bg-destructive/5 px-3 py-3 sm:px-4 space-y-2',
          wrapperClassName,
        )}
        data-testid="crm-audio-player-error"
        role="alert"
      >
        <p className="text-sm text-destructive">{LOAD_ERROR_MESSAGE}</p>
        <Button
          type="button"
          size="sm"
          intent="secondary"
          className="min-h-11"
          onClick={player.retry}
        >
          <RefreshCw className={iconSize.sm} />
          Повторить
        </Button>
      </div>
    );
  }

  const barClass = isVoice ? 'lh-chat-voice__bar' : 'lh-audio__bar';
  const barFilled = isVoice ? 'lh-chat-voice__bar--filled' : 'lh-audio__bar--filled';

  const hiddenAudio = (
    <audio
      ref={player.audioRef}
      className="lh-audio-engine crm-audio-player__element sr-only"
      preload={preload}
      src={src}
      // eslint-disable-next-line react/no-unknown-property -- iOS Safari
      playsInline
    />
  );

  const scrubber = (
    <div
      ref={player.trackRef}
      className={cn(
        'lh-audio__track relative min-h-11 min-w-0 flex-1 touch-none select-none',
        isVoice ? 'lh-chat-voice__wave' : null,
      )}
      role="slider"
      tabIndex={0}
      aria-label="Перемотка аудио"
      aria-valuemin={0}
      aria-valuemax={Math.round(shownDuration || 0)}
      aria-valuenow={Math.round(player.currentSec)}
      aria-valuetext={`${clockCurrent} из ${clockDuration}`}
      onPointerDown={player.onTrackPointerDown}
      onPointerMove={player.onTrackPointerMove}
      onPointerUp={player.endDrag}
      onPointerCancel={player.endDrag}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          player.nudge(player.SEEK_NUDGE_SECONDS);
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          player.nudge(-player.SEEK_NUDGE_SECONDS);
        }
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          void player.toggle();
        }
        if (event.key === 'Home') {
          event.preventDefault();
          player.seekTo(0);
        }
        if (event.key === 'End' && isFiniteDuration(shownDuration)) {
          event.preventDefault();
          player.seekTo(shownDuration);
        }
      }}
    >
      {isVoice ? (
        bars.map((height, index) => {
          const filled = index / bars.length <= player.progress;
          return (
            <span
              key={index}
              className={cn(barClass, filled && barFilled)}
              style={{ height: `${Math.round(height * 100)}%` }}
            />
          );
        })
      ) : (
        <>
          <div
            className="lh-audio__wave pointer-events-none absolute inset-y-2 inset-x-0 flex items-center gap-px"
            aria-hidden
          >
            {bars.map((height, index) => {
              const filled = index / bars.length <= player.progress;
              return (
                <span
                  key={index}
                  className={cn(barClass, filled && barFilled)}
                  style={{ height: `${Math.round(height * 100)}%` }}
                />
              );
            })}
          </div>
          <span
            className="lh-audio__thumb pointer-events-none absolute top-1/2 z-[1] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand-gold)] shadow-sm"
            style={{ left: `${Math.min(100, Math.max(0, player.progress * 100))}%` }}
            aria-hidden
          />
        </>
      )}
    </div>
  );

  const speedBtn = (
    <button
      type="button"
      className={cn(
        'lh-audio__speed min-h-11 min-w-11 shrink-0 rounded-lg text-xs font-semibold tabular-nums',
        isVoice && 'lh-chat-voice__speed',
      )}
      aria-label={`Скорость ${player.speed}x`}
      onClick={player.cycleSpeed}
    >
      {player.speed}x
    </button>
  );

  const playBtn = (
    <IconButton
      type="button"
      label={player.playing ? 'Пауза' : 'Воспроизвести'}
      intent={isVoice && own ? 'gold' : 'primary'}
      className={cn('lh-audio__play shrink-0', isVoice && 'lh-chat-voice__play')}
      onClick={() => void player.toggle()}
      disabled={!src}
    >
      {player.playing && !player.buffering ? <Pause /> : <Play />}
    </IconButton>
  );

  if (isVoice) {
    return (
      <div
        className={cn(
          'lh-chat-voice lh-audio lh-audio--voice',
          own ? 'lh-chat-voice--own' : 'lh-chat-voice--peer',
          className,
          wrapperClassName,
        )}
        data-testid="crm-audio-player"
        data-variant="voice"
        data-audio-instance={reactId}
      >
        {playBtn}
        {scrubber}
        <span className="lh-chat-voice__clock lh-audio__clock tabular-nums">
          {!player.ready && !isFiniteDuration(shownDuration) ? '…' : clockCurrent}
        </span>
        {speedBtn}
        {hiddenAudio}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'crm-audio-player lh-audio w-full max-w-full rounded-xl border border-border',
        'bg-card px-3 py-2.5 sm:px-4 sm:py-3',
        variant === 'compact' && 'py-2',
        wrapperClassName,
        className,
      )}
      data-testid="crm-audio-player"
      data-variant={variant}
      data-audio-instance={reactId}
    >
      {!player.ready && !isFiniteDuration(shownDuration) ? (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className={cn(iconSize.sm, 'animate-spin shrink-0')} aria-hidden />
          <span>Загрузка аудио…</span>
        </div>
      ) : null}
      {player.buffering && player.playing ? (
        <p className="mb-1 text-xs text-muted-foreground">Буферизация…</p>
      ) : null}
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {playBtn}
        <button
          type="button"
          className="lh-audio__nudge min-h-11 min-w-11 shrink-0 rounded-lg text-xs font-semibold tabular-nums"
          aria-label={`Назад на ${player.SEEK_NUDGE_SECONDS} секунд`}
          onClick={() => player.nudge(-player.SEEK_NUDGE_SECONDS)}
        >
          −{player.SEEK_NUDGE_SECONDS}
        </button>
        {scrubber}
        <button
          type="button"
          className="lh-audio__nudge min-h-11 min-w-11 shrink-0 rounded-lg text-xs font-semibold tabular-nums"
          aria-label={`Вперёд на ${player.SEEK_NUDGE_SECONDS} секунд`}
          onClick={() => player.nudge(player.SEEK_NUDGE_SECONDS)}
        >
          +{player.SEEK_NUDGE_SECONDS}
        </button>
        <span className="lh-audio__clock shrink-0 text-xs tabular-nums text-muted-foreground">
          {clockCurrent}
          {isFiniteDuration(shownDuration) ? ` / ${clockDuration}` : ''}
        </span>
        {speedBtn}
        <IconButton
          type="button"
          intent="ghost"
          label={player.muted || player.volume === 0 ? 'Включить звук' : 'Без звука'}
          className="min-h-11 min-w-11 shrink-0"
          onClick={player.toggleMute}
        >
          {player.muted || player.volume === 0 ? <VolumeX /> : <Volume2 />}
        </IconButton>
      </div>
      <label className="mt-2 flex min-h-11 items-center gap-2">
        <span className="sr-only">Громкость</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          className="lh-audio__volume min-h-11 w-full accent-[var(--brand-primary)]"
          value={player.muted ? 0 : player.volume}
          aria-label="Громкость"
          onChange={(event) => player.setVolume(event.target.value)}
        />
      </label>
      {hiddenAudio}
    </div>
  );
}
