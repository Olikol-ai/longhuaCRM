import { Pause, Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { chatAttachmentSrc } from '@/lib/chat-attachment-url';

export default function VoicePlayer({ attachment }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const src = chatAttachmentSrc(attachment.id);

  const toggle = async () => {
    if (!audioRef.current || !src) return;
    if (audioRef.current.paused) await audioRef.current.play();
    else audioRef.current.pause();
  };

  return (
    <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={toggle} disabled={!src}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <span className="text-xs text-muted-foreground">Голосовое сообщение</span>
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      ) : null}
    </div>
  );
}
