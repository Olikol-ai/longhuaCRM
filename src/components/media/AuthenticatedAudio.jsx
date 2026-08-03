import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { withAccessToken } from '@/lib/auth-media-url';
import {
  claimLearningAudio,
  disposeLearningAudioElement,
  releaseLearningAudio,
} from '@/lib/learning-audio-runtime';

const LOAD_ERROR_MESSAGE =
  'Не удалось загрузить аудиозапись. Попробуйте обновить страницу или повторить попытку позже.';

/**
 * Single CRM-wide HTML5 audio player for learning content.
 *
 * Used in HSK Academy, homework, exams, listening blocks, question bank,
 * previews, speaking playback, and teacher review.
 *
 * Full native controls: play, pause, seek, volume, duration — no HSK exam limits.
 * Only one learning audio plays at a time; unmount disposes the media element.
 */
export default function AuthenticatedAudio({
  src,
  className,
  preload = 'metadata',
  /** Extra class on the outer chrome only (margin etc.). */
  wrapperClassName,
}) {
  const reactId = useId();
  const audioRef = useRef(null);
  const [resolved, setResolved] = useState(() => withAccessToken(src));
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    setResolved(withAccessToken(src));
    setFailed(false);
    setReady(false);
  }, [src, retryToken]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;

    const markReady = () => setReady(true);
    const onPlay = () => claimLearningAudio(el);
    const onError = () => {
      setFailed(true);
      setReady(false);
    };

    el.addEventListener('loadedmetadata', markReady);
    el.addEventListener('canplay', markReady);
    el.addEventListener('play', onPlay);
    el.addEventListener('error', onError);

    if (el.readyState >= 1) {
      setReady(true);
    }

    return () => {
      el.removeEventListener('loadedmetadata', markReady);
      el.removeEventListener('canplay', markReady);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('error', onError);
      disposeLearningAudioElement(el);
    };
  }, [resolved, retryToken]);

  useEffect(() => {
    return () => {
      releaseLearningAudio(audioRef.current);
    };
  }, []);

  if (!src) {
    return (
      <p
        className={cn('text-sm text-muted-foreground', wrapperClassName)}
        data-testid="crm-audio-player-empty"
      >
        Аудиофайл недоступен.
      </p>
    );
  }

  if (failed || !resolved) {
    return (
      <div
        className={cn(
          'crm-audio-player w-full max-w-full rounded-xl border border-destructive/30',
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
          variant="outline"
          className="min-h-11"
          onClick={() => {
            setFailed(false);
            setReady(false);
            setRetryToken((n) => n + 1);
          }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'crm-audio-player w-full max-w-full rounded-xl border border-slate-200 dark:border-slate-700',
        'bg-slate-50 dark:bg-slate-950/60 px-3 py-2.5 sm:px-4 sm:py-3',
        wrapperClassName,
      )}
      data-testid="crm-audio-player"
      data-audio-instance={reactId}
    >
      {!ready ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
          <span>Загрузка аудио…</span>
        </div>
      ) : null}
      <audio
        key={`${resolved}::${retryToken}`}
        ref={audioRef}
        controls
        controlsList="nodownload"
        className={cn(
          'crm-audio-player__element w-full max-w-full min-h-11 h-11 sm:h-12 block',
          className,
        )}
        preload={preload}
        src={resolved}
        playsInline
      >
        Ваш браузер не поддерживает воспроизведение аудио.
      </audio>
    </div>
  );
}
