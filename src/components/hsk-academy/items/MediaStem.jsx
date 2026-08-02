import { useEffect, useRef } from 'react';

/**
 * Renders stem media (image / audio / video) with CRM-friendly sizing.
 */
export default function MediaStem({ attachments = [], prefetchUrls = [] }) {
  const audioRef = useRef(null);

  useEffect(() => {
    for (const url of prefetchUrls) {
      if (!url) continue;
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'fetch';
      link.href = url;
      document.head.appendChild(link);
    }
  }, [prefetchUrls]);

  if (!attachments.length) return null;

  return (
    <div className="space-y-3">
      {attachments.map((att) => {
        const key = att.id || att.url;
        const kind = String(att.kind || '').toLowerCase();
        if ((kind === 'audio' || kind === 'sound') && att.url) {
          return (
            <audio
              key={key}
              ref={audioRef}
              className="w-full max-w-full"
              controls
              preload="metadata"
              src={att.url}
            >
              Аудио недоступно
            </audio>
          );
        }
        if ((kind === 'video') && att.url) {
          return (
            <video
              key={key}
              className="w-full max-w-full rounded-md border border-border bg-muted"
              controls
              preload="metadata"
              src={att.url}
            >
              Видео недоступно
            </video>
          );
        }
        if ((kind === 'image' || kind === 'img') && att.url) {
          return (
            <img
              key={key}
              className="max-w-full h-auto rounded-md border border-border"
              src={att.url}
              alt=""
            />
          );
        }
        return null;
      })}
    </div>
  );
}
