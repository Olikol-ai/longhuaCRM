/**
 * Chat list prefs.
 *
 * SSOT for archive/pin/mute/favorite = PostgreSQL chat_members via API.
 * Local storage holds ONLY drafts (device-local composer text), scoped by userId.
 */

function draftsKey(userId) {
  return `longhua_chat_drafts_v1:${userId || 'anon'}`;
}

function readDrafts(userId) {
  try {
    const raw = localStorage.getItem(draftsKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDrafts(userId, drafts) {
  localStorage.setItem(draftsKey(userId), JSON.stringify(drafts || {}));
  return drafts;
}

/** @deprecated Legacy unscoped key — never authoritative after server prefs. */
export const LEGACY_CHAT_PREFS_KEY = 'longhua_chat_prefs_v2';

export function emptyUserState() {
  return {
    archived: false,
    pinned: false,
    muted: false,
    favorite: false,
    mutedUntil: null,
    archivedAt: null,
    pinnedAt: null,
    favoritedAt: null,
    lastReadMessageId: null,
  };
}

export function normalizeUserState(raw) {
  const src = raw?.userState || raw?.user_state || raw || {};
  return {
    archived: Boolean(src.archived),
    pinned: Boolean(src.pinned),
    muted: Boolean(src.muted),
    favorite: Boolean(src.favorite),
    mutedUntil: src.mutedUntil ?? src.muted_until ?? null,
    archivedAt: src.archivedAt ?? src.archived_at ?? null,
    pinnedAt: src.pinnedAt ?? src.pinned_at ?? null,
    favoritedAt: src.favoritedAt ?? src.favorited_at ?? null,
    lastReadMessageId: src.lastReadMessageId ?? src.last_read_message_id ?? null,
  };
}

export function chatUserState(chat) {
  return normalizeUserState(chat);
}

export function isChatMuted(chatOrState) {
  if (!chatOrState) return false;
  if (typeof chatOrState === 'string') return false;
  const state = chatOrState.userState || chatOrState.user_state || chatOrState;
  if (typeof state.muted === 'boolean') return state.muted;
  const until = state.mutedUntil || state.muted_until;
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

export function isChatArchived(chat) {
  return Boolean(chatUserState(chat).archived);
}

export function isChatPinned(chat) {
  return Boolean(chatUserState(chat).pinned);
}

export function isChatFavorite(chat) {
  return Boolean(chatUserState(chat).favorite);
}

export function setChatDraft(chatId, text, userId) {
  if (!chatId) return;
  const drafts = { ...readDrafts(userId) };
  const trimmed = String(text || '');
  if (!trimmed) delete drafts[chatId];
  else drafts[chatId] = trimmed;
  writeDrafts(userId, drafts);
}

export function getChatDraft(chatId, userId) {
  if (!chatId) return '';
  return readDrafts(userId)[chatId] || '';
}

export function clearLocalChatDrafts(userId) {
  try {
    localStorage.removeItem(draftsKey(userId));
  } catch {
    /* ignore */
  }
}

/** Drop legacy device-local prefs so they cannot fight server SSOT. */
export function clearLegacyLocalChatPrefs() {
  try {
    localStorage.removeItem(LEGACY_CHAT_PREFS_KEY);
  } catch {
    /* ignore */
  }
}

export function sortChatsForList(chats, previewByChat = {}) {
  return [...chats].sort((a, b) => {
    const ap = isChatPinned(a) ? 0 : 1;
    const bp = isChatPinned(b) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const at = previewByChat[a.id]?.at || new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bt = previewByChat[b.id]?.at || new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bt - at;
  });
}

export function applyUserStateToChat(chat, userState) {
  const next = normalizeUserState(userState);
  return {
    ...chat,
    userState: next,
    archived: next.archived,
    pinned: next.pinned,
    muted: next.muted,
    favorite: next.favorite,
  };
}

export function patchChatInGroups(groups, chatId, userState) {
  if (!groups || typeof groups !== 'object') return groups || {};
  return Object.fromEntries(
    Object.entries(groups).map(([kind, list]) => [
      kind,
      Array.isArray(list)
        ? list.map((chat) =>
            chat?.id === chatId ? applyUserStateToChat(chat, userState) : chat,
          )
        : list,
    ]),
  );
}
