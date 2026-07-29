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
  createDirect: (userId) => apiFetch('/chats/direct', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  }),
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
  askAi: (chatId, prompt) => apiFetch(`/chats/${chatId}/ai`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  }),
  directory: (filters) => apiFetch(`/chats/directory${queryString(filters)}`),
  updateProfile: (payload) => apiFetch('/chats/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  downloadUrl: (attachmentId) => `/api/chats/attachments/${attachmentId}/download`,
};
