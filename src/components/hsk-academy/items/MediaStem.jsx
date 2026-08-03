import { useEffect } from 'react';
import AuthenticatedAudio from '@/components/media/AuthenticatedAudio';
import AuthenticatedVideo from '@/components/media/AuthenticatedVideo';
import { withAccessToken } from '@/lib/auth-media-url';
import { getAttachmentAudioKey, isAudioAttachment } from '@/lib/listening-display';

/**
 * Stem media for HSK items — audio always via the shared CRM player.
 */
export default function MediaStem({
  attachments = [],
  prefetchUrls = [],
  hideAudioKey = null,
  hideAllAudio = false,
}) {
  useEffect(() => {
    const links = [];
    for (const url of prefetchUrls) {
      const href = withAccessToken(url);
      if (!href) continue;
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'fetch';
      link.href = href;
      document.head.appendChild(link);
      links.push(link);
    }
    return () => {
      for (const link of links) link.remove();
    };
  }, [prefetchUrls]);

  const visible = (attachments || []).filter((att) => {
    if (!isAudioAttachment(att)) return true;
    if (hideAllAudio) return false;
    if (!hideAudioKey) return true;
    return getAttachmentAudioKey(att) !== hideAudioKey;
  });

  if (!visible.length) return null;

  return (
    <div className="space-y-2.5 min-w-0">
      {visible.map((att) => {
        const key = att.id || att.url;
        const kind = String(att.kind || '').toLowerCase();
        const url = withAccessToken(att.url);
        if (isAudioAttachment(att) && att.url) {
          return <AuthenticatedAudio key={key} src={att.url} />;
        }
        if (kind === 'video' && att.url) {
          return (
            <AuthenticatedVideo
              key={key}
              src={att.url}
              className="w-full max-w-full max-h-[min(36vh,280px)] rounded-md border border-border bg-muted object-contain"
            />
          );
        }
        if ((kind === 'image' || kind === 'img') && url) {
          return (
            <div
              key={key}
              className="rounded-md border border-border bg-muted/30 overflow-hidden flex justify-center"
            >
              <img
                className="max-w-full max-h-[min(40vh,320px)] w-auto h-auto object-contain"
                src={url}
                alt=""
              />
            </div>
          );
        }
        if (isAudioAttachment(att) && !att.url) {
          return (
            <p key={key} className="text-sm text-destructive">
              Аудиофайл недоступен.
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
