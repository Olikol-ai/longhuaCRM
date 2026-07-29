import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/api/http';
import { Button } from '@/components/ui/button';
import { chatsApi } from '@/api/chats.api';

export default function VoicePlayer({ attachment }) {
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const [readyUrl, setReadyUrl] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      const response = await fetch(chatsApi.downloadUrl(attachment.id), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) throw new Error('Не удалось загрузить голосовое сообщение');
      const objectUrl = URL.createObjectURL(await response.blob());
      urlRef.current = objectUrl;
      if (!disposed) setReadyUrl(objectUrl);
    };
    void load().catch(() => setReadyUrl(null));
    return () => {
      disposed = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [attachment.id]);

  const toggle = async () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) await audioRef.current.play();
    else audioRef.current.pause();
  };

  return (
    <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={toggle} disabled={!readyUrl}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <span className="text-xs text-muted-foreground">Голосовое сообщение</span>
      {readyUrl ? (
        <audio
          ref={audioRef}
          src={readyUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      ) : null}
    </div>
  );
}
