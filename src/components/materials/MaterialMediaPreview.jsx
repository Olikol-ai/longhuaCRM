import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import AuthenticatedAudio from '@/components/media/AuthenticatedAudio';
import { resolveMaterialOpenUrl } from '@/lib/materialUrl';
import { isAudioMaterial, isVideoMaterial } from '@/lib/materialMeta';
import { withAccessToken } from '@/lib/auth-media-url';

/**
 * In-app preview for audio (CRM AuthenticatedAudio) and video materials.
 */
export default function MaterialMediaPreview({ material, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setUrl(null);
      try {
        const resolved = await resolveMaterialOpenUrl(material);
        if (!cancelled) setUrl(resolved);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Не удалось открыть файл');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [material?.id, material?.file_url]);

  const audio = isAudioMaterial(material);
  const video = isVideoMaterial(material);
  const mediaSrc = url ? withAccessToken(url) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {material?.title || 'Материал'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {audio ? 'Аудио' : video ? 'Видео' : 'Медиафайл'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-muted shrink-0">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : audio && mediaSrc ? (
            <AuthenticatedAudio src={url} wrapperClassName="w-full" />
          ) : video && mediaSrc ? (
            <video
              key={mediaSrc}
              src={mediaSrc}
              controls
              playsInline
              preload="metadata"
              className="w-full max-h-[70vh] rounded-xl bg-black"
            >
              <track kind="captions" />
            </video>
          ) : (
            <p className="text-sm text-muted-foreground">Нет файла для воспроизведения</p>
          )}
        </div>
      </div>
    </div>
  );
}
