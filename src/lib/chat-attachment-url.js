import { getToken } from '@/api/http';
import { chatsApi } from '@/api/chats.api';

/** Authenticated media URL for <img>/<audio>/<video> (JWT via query). */
export function chatAttachmentSrc(attachmentId, { disposition } = {}) {
  if (!attachmentId) return null;
  const token = getToken();
  const base = chatsApi.downloadUrl(attachmentId, { disposition });
  if (!token) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}access_token=${encodeURIComponent(token)}`;
}

/** Force-download URL (Content-Disposition: attachment). */
export function chatAttachmentDownloadSrc(attachmentId) {
  return chatAttachmentSrc(attachmentId, { disposition: 'attachment' });
}

/**
 * Load a chat attachment with Authorization Bearer (not query token).
 * Prefer this for <audio>/<video> so every chat member gets the same path,
 * Range quirks are avoided for short voice clips, and errors map to HTTP status.
 */
export async function fetchChatAttachmentBlob(attachmentId, { disposition } = {}) {
  if (!attachmentId) {
    throw new Error('Вложение не найдено');
  }
  const token = getToken();
  const url = chatsApi.downloadUrl(attachmentId, { disposition });
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, credentials: 'same-origin' });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Нет доступа к файлу. Обновите страницу или войдите снова.');
    }
    if (res.status === 404) {
      throw new Error('Файл был удалён или недоступен.');
    }
    throw new Error('Не удалось загрузить файл.');
  }
  return res.blob();
}
