import { displayUserName, pickField } from '../chat-normalize.js';

/**
 * Unified chat title for list + header (DM → peer name, else stored title).
 */
export function resolveChatTitle(chat, { currentUserId, members = [] } = {}) {
  if (!chat) return 'Чат';
  const stored = String(chat.title || '').trim();
  if (chat.kind !== 'direct') {
    return stored || 'Чат';
  }
  if (stored && stored !== 'Личный чат') return stored;

  const peerFromPayload = chat.peer || chat.peerUser || chat.peer_user;
  if (peerFromPayload) {
    const name = displayUserName(peerFromPayload);
    if (name && name !== 'Пользователь') return name;
  }

  const memberUserIds = chat.memberUserIds || chat.member_user_ids || [];
  const peerFromMembers = (members || [])
    .map((m) => pickField(m, 'user') || {})
    .find((u) => u?.id && u.id !== currentUserId);
  if (peerFromMembers) {
    const name = displayUserName(peerFromMembers);
    if (name && name !== 'Пользователь') return name;
  }

  const peerId =
    memberUserIds.find((id) => id && id !== currentUserId) || null;
  if (peerId && peerFromMembers?.id === peerId) {
    return displayUserName(peerFromMembers);
  }

  return stored || 'Собеседник';
}

export function resolveChatPeerUser(chat, { currentUserId, members = [] } = {}) {
  if (!chat || chat.kind !== 'direct') return null;
  if (chat.peer || chat.peerUser || chat.peer_user) {
    return chat.peer || chat.peerUser || chat.peer_user;
  }
  return (
    (members || [])
      .map((m) => pickField(m, 'user') || {})
      .find((u) => u?.id && u.id !== currentUserId) || null
  );
}
