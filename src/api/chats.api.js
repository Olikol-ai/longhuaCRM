import { apiFetch, apiUploadTo } from './http';

const queryString = (params = {}) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  const value = search.toString();
  return value ? `?${value}` : '';
};

export const chatsApi = {
  list: () => apiFetch('/chats'),
  unreadCount: () => apiFetch('/chats/unread-count'),
  get: (chatId) => apiFetch(`/chats/${chatId}`),
  messages: (chatId, params) => apiFetch(`/chats/${chatId}/messages${queryString(params)}`),
  sendMessage: (chatId, payload) => apiFetch(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateMessage: (messageId, body) => apiFetch(`/chats/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  }),
  deleteMessage: (messageId) => apiFetch(`/chats/messages/${messageId}`, { method: 'DELETE' }),
  createDmRequest: (toUserId, message) => apiFetch('/chats/dm-requests', {
    method: 'POST',
    body: JSON.stringify({ toUserId, message }),
  }),
  listIncomingDmRequests: (params) => apiFetch(`/chats/dm-requests/incoming${queryString(params)}`),
  listOutgoingDmRequests: (params) => apiFetch(`/chats/dm-requests/outgoing${queryString(params)}`),
  acceptDmRequest: (id) => apiFetch(`/chats/dm-requests/${id}/accept`, { method: 'POST' }),
  declineDmRequest: (id) => apiFetch(`/chats/dm-requests/${id}/decline`, { method: 'POST' }),
  cancelDmRequest: (id) => apiFetch(`/chats/dm-requests/${id}/cancel`, { method: 'POST' }),
  getPrivacy: () => apiFetch('/chats/privacy'),
  updatePrivacy: (dmPolicy) => apiFetch('/chats/privacy', {
    method: 'PATCH',
    body: JSON.stringify({ dmPolicy }),
  }),
  listBlocks: () => apiFetch('/chats/blocks'),
  blockUser: (blockedUserId) => apiFetch('/chats/blocks', {
    method: 'POST',
    body: JSON.stringify({ blockedUserId }),
  }),
  unblockUser: (blockedUserId) => apiFetch(`/chats/blocks/${blockedUserId}`, { method: 'DELETE' }),
  hideMembership: (chatId) => apiFetch(`/chats/${chatId}/membership`, { method: 'DELETE' }),
  createGroup: (payload) => apiFetch('/chats/groups', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  addMembers: (chatId, memberUserIds) => apiFetch(`/chats/${chatId}/members`, {
    method: 'POST',
    body: JSON.stringify({ memberUserIds }),
  }),
  markRead: (chatId, messageId) => apiFetch(`/chats/${chatId}/read`, {
    method: 'PATCH',
    body: JSON.stringify({ messageId }),
  }),
  members: (chatId) => apiFetch(`/chats/${chatId}/members`),
  pins: (chatId) => apiFetch(`/chats/${chatId}/pins`),
  pin: (chatId, messageId) => apiFetch(`/chats/${chatId}/pins/${messageId}`, { method: 'POST' }),
  unpin: (chatId, messageId) => apiFetch(`/chats/${chatId}/pins/${messageId}`, { method: 'DELETE' }),
  uploadAttachment: (chatId, file, { kind = 'file', durationMs } = {}) =>
    apiUploadTo(`/chats/${chatId}/attachments${queryString({ kind, durationMs })}`, file),
  e2ee: async (chatId) => {
    const raw = await apiFetch(`/chats/${chatId}/e2ee`);
    const peersRaw = raw?.peers;
    return {
      chatId: raw?.chatId ?? raw?.chat_id ?? chatId,
      kind: raw?.kind,
      e2ee: raw?.e2ee !== false,
      peers: Array.isArray(peersRaw)
        ? peersRaw.map((peer) => ({
            userId: peer?.userId ?? peer?.user_id,
            publicKey: peer?.publicKey ?? peer?.public_key,
            algorithm: peer?.algorithm,
            keyVersion: peer?.keyVersion ?? peer?.key_version ?? 1,
          }))
        : [],
    };
  },
  directory: (filters) => apiFetch(`/chats/directory${queryString(filters)}`),
  updateProfile: (payload) => apiFetch('/chats/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  downloadUrl: (attachmentId, { disposition } = {}) =>
    `/api/chats/attachments/${attachmentId}/download${queryString({ disposition })}`,
};
