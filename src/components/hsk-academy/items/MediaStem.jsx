import { useEffect, useRef } from 'react';

/**
 * Renders stem media (image / audio / video) with space-efficient CRM sizing.
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
    <div className="space-y-2.5 min-w-0">
      {attachments.map((att) => {
        const key = att.id || att.url;
        const kind = String(att.kind || '').toLowerCase();
        if ((kind === 'audio' || kind === 'sound') && att.url) {
          return (
            <audio
              key={key}
              ref={audioRef}
              className="w-full max-w-full h-10"
              controls
              preload="metadata"
              src={att.url}
            >
              Аудио недоступно
            </audio>
          );
        }
        if (kind === 'video' && att.url) {
          return (
            <video
              key={key}
              className="w-full max-w-full max-h-[min(36vh,280px)] rounded-md border border-border bg-muted object-contain"
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
            <div
              key={key}
              className="rounded-md border border-border bg-muted/30 overflow-hidden flex justify-center"
            >
              <img
                className="max-w-full max-h-[min(40vh,320px)] w-auto h-auto object-contain"
                src={att.url}
                alt=""
              />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
