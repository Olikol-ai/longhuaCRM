import { Loader2 } from 'lucide-react';
import LonghuaAudioPlayer from '@/components/media/LonghuaAudioPlayer';
import { useChatAttachmentObjectUrl } from '@/lib/use-chat-attachment-object-url';
import { cn } from '@/lib/utils';

/**
 * Chat voice message — same LonghuaAudioPlayer engine (variant="voice").
 */
export default function VoicePlayer({
  attachment,
  own = false,
  mediaLocked = false,
  standalone = false,
}) {
  const { src, error: loadError, loading } = useChatAttachmentObjectUrl(
    mediaLocked ? null : attachment?.id,
    { enabled: Boolean(attachment?.id) && !mediaLocked },
  );
  const durationHintMs = attachment?.durationMs ?? attachment?.duration_ms ?? null;

  if (mediaLocked) {
    return (
      <p className="text-xs text-muted-foreground px-1 py-2">Голосовое сообщение недоступно.</p>
    );
  }

  if (loadError) {
    return (
      <div
        className={cn(
          'lh-chat-voice',
          standalone && 'lh-chat-voice--standalone',
          own ? 'lh-chat-voice--own' : 'lh-chat-voice--peer',
        )}
        role="alert"
      >
        <span className="text-xs px-2 py-1">Не удалось загрузить</span>
      </div>
    );
  }

  if (loading || !src) {
    return (
      <div
        className={cn(
          'lh-chat-voice',
          standalone && 'lh-chat-voice--standalone',
          own ? 'lh-chat-voice--own' : 'lh-chat-voice--peer',
        )}
        data-testid="voice-player-loading"
      >
        <Loader2 className="size-5 animate-spin shrink-0 opacity-70" aria-hidden />
        <span className="text-xs opacity-80">Загрузка…</span>
      </div>
    );
  }

  return (
    <LonghuaAudioPlayer
      src={src}
      variant="voice"
      own={own}
      durationHintMs={durationHintMs}
      waveformSeed={attachment?.id}
      wrapperClassName={cn(standalone && 'lh-chat-voice--standalone')}
    />
  );
}
