import { getToken } from '@/api/http';

/**
 * Append JWT as access_token for media elements (<audio>/<video>/<img>).
 * Browsers cannot send Authorization on those requests; Nest JWT strategy
 * already accepts ?access_token= (same as avatars / chat attachments).
 */
export function withAccessToken(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (/^https?:\/\//i.test(url) && !url.includes('/api/')) return url;

  const token = getToken();
  if (!token) return url;

  try {
    const base =
      typeof window !== 'undefined' && url.startsWith('/')
        ? `${window.location.origin}${url}`
        : url;
    const parsed = new URL(base, typeof window !== 'undefined' ? window.location.origin : 'http://local');
    if (!parsed.pathname.includes('/api/') && !url.startsWith('/api/')) {
      return url;
    }
    parsed.searchParams.set('access_token', token);
    if (url.startsWith('/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}access_token=${encodeURIComponent(token)}`;
  }
}

/** Resolve attachment download URL (explicit url or /api/.../download by id). */
export function resolveAttachmentMediaUrl(attachment, downloadUrlById) {
  if (!attachment) return null;
  const raw =
    attachment.url ||
    (attachment.id && typeof downloadUrlById === 'function'
      ? downloadUrlById(attachment.id)
      : null);
  return raw ? withAccessToken(raw) : null;
}
