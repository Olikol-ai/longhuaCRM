import { getToken } from '@/api/http';
import { chatsApi } from '@/api/chats.api';

/** Authenticated media URL for <img>/<audio> (JWT via query, same as avatars). */
export function chatAttachmentSrc(attachmentId) {
  if (!attachmentId) return null;
  const token = getToken();
  const base = chatsApi.downloadUrl(attachmentId);
  if (!token) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}access_token=${encodeURIComponent(token)}`;
}
