import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useChatAttachmentObjectUrl } from '@/lib/use-chat-attachment-object-url';

function formatDuration(ms) {
  if (!ms || ms < 0) return '';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VoicePlayer({ attachment }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState(null);
  const { src, error: loadError, loading } = useChatAttachmentObjectUrl(attachment?.id);
  const label = formatDuration(attachment.durationMs ?? attachment.duration_ms);
  const error = playError || loadError;

  useEffect(() => {
    setPlayError(null);
    setPlaying(false);
  }, [attachment?.id, src]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el || !src) return;
    try {
      if (el.paused) {
        await el.play();
      } else {
        el.pause();
      }
    } catch (err) {
      setPlayError(err?.message || 'Не удалось воспроизвести');
    }
  };

  return (
    <div className="mt-1 flex max-w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-11 w-11 shrink-0"
        onClick={() => void toggle()}
        disabled={!src || loading}
        aria-label={playing ? 'Пауза' : 'Воспроизвести'}
      >
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </Button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">Голосовое сообщение</p>
        {label ? <p className="text-[11px] text-muted-foreground">{label}</p> : null}
        {loading && !error ? (
          <p className="text-[11px] text-muted-foreground">Загрузка…</p>
        ) : null}
        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      </div>
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() =>
            setPlayError('Не удалось воспроизвести аудио. Формат может не поддерживаться браузером.')
          }
        />
      ) : null}
    </div>
  );
}
