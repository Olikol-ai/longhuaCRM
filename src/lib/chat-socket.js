import { io } from 'socket.io-client';
import { getToken } from '@/api/http';

let socket = null;

export function connectChatSocket() {
  const token = getToken();
  if (!token) return null;
  if (socket?.connected || socket?.active) return socket;

  socket = io('/chat', {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function disconnectChatSocket() {
  socket?.disconnect();
  socket = null;
}

export function subscribeToChatSocket(handlers) {
  const client = connectChatSocket();
  if (!client) return () => {};

  Object.entries(handlers).forEach(([event, handler]) => client.on(event, handler));
  return () => {
    Object.entries(handlers).forEach(([event, handler]) => client.off(event, handler));
  };
}

export function joinChat(chatId) {
  connectChatSocket()?.emit('chat:join', { chatId });
}

export function leaveChat(chatId) {
  socket?.emit('chat:leave', { chatId });
}

export function emitTyping(chatId, isTyping) {
  socket?.emit(isTyping ? 'typing:start' : 'typing:stop', { chatId });
}

export function emitMessageRead(chatId, messageId) {
  socket?.emit('message:read', { chatId, messageId });
}
