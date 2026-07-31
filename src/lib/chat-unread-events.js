/**
 * Cross-page chat unread badge sync (Layout ↔ Chats).
 * Uses a window CustomEvent so Layout refreshes immediately after mark-as-read.
 */

export const CHAT_UNREAD_EVENT = 'longhua:chat-unread';

export function publishChatUnreadTotal(total) {
  if (typeof window === 'undefined') return;
  const value = Math.max(0, Number(total) || 0);
  window.dispatchEvent(
    new CustomEvent(CHAT_UNREAD_EVENT, { detail: { total: value } }),
  );
}

export function subscribeChatUnreadTotal(handler) {
  if (typeof window === 'undefined') return () => {};
  const onEvent = (event) => {
    handler(event?.detail?.total ?? 0);
  };
  window.addEventListener(CHAT_UNREAD_EVENT, onEvent);
  return () => window.removeEventListener(CHAT_UNREAD_EVENT, onEvent);
}
