import { useEffect, useState } from 'react';
import { fetchChatAttachmentBlob } from '@/lib/chat-attachment-url';

/**
 * Resolves a chat attachment to a temporary blob: URL with Bearer auth.
 * Revokes the object URL on change/unmount.
 * When enabled=false, does not fetch and never creates a plaintext object URL.
 */
export function useChatAttachmentObjectUrl(attachmentId, { enabled = true } = {}) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(attachmentId) && enabled);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    setSrc(null);
    setError(null);

    if (!attachmentId || !enabled) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    void (async () => {
      try {
        const blob = await fetchChatAttachmentBlob(attachmentId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setSrc(null);
        setError(err?.message || 'Не удалось загрузить файл.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, enabled]);

  return { src, error, loading };
}
