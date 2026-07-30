import { io } from 'socket.io-client';
import { getToken, onTokenChange } from '@/api/http';

const HEARTBEAT_MS = 30_000;

let socket = null;
let heartbeatTimer = null;
let tokenUnsub = null;
/** @type {Set<(event: string, payload: unknown) => void>} */
const presenceListeners = new Set();

function emitLocal(event, payload) {
  presenceListeners.forEach((listener) => {
    try {
      listener(event, payload);
    } catch {
      // ignore listener errors
    }
  });
}

function clearHeartbeat() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat(client) {
  clearHeartbeat();
  const ping = () => {
    if (client?.connected) client.emit('presence:ping');
  };
  ping();
  heartbeatTimer = window.setInterval(ping, HEARTBEAT_MS);
}

function bindPresenceEvents(client) {
  client.off('presence.sync');
  client.off('user.online');
  client.off('user.offline');
  client.off('connect');
  client.off('reconnect');

  client.on('presence.sync', (payload) => emitLocal('presence.sync', payload));
  client.on('user.online', (payload) => emitLocal('user.online', payload));
  client.on('user.offline', (payload) => emitLocal('user.offline', payload));
  client.on('connect', () => {
    startHeartbeat(client);
    emitLocal('socket.connect', null);
  });
  client.on('reconnect', () => {
    startHeartbeat(client);
    emitLocal('socket.reconnect', null);
  });
}

/**
 * Keep a single CRM presence socket for the whole authenticated session.
 * Do not disconnect when leaving the Chats page.
 */
export function connectChatSocket() {
  const token = getToken();
  if (!token) return null;

  if (!tokenUnsub) {
    tokenUnsub = onTokenChange(() => {
      const next = getToken();
      if (!next) {
        disconnectChatSocket();
        return;
      }
      if (socket) {
        socket.auth = { token: next };
      }
    });
  }

  if (socket?.connected || socket?.active) {
    if (socket.auth?.token !== token) {
      socket.auth = { token };
    }
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io('/chat', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
  bindPresenceEvents(socket);
  if (socket.connected) startHeartbeat(socket);
  return socket;
}

export function disconnectChatSocket() {
  clearHeartbeat();
  socket?.disconnect();
  socket = null;
}

export function getChatSocket() {
  return socket;
}

export function onPresenceEvent(listener) {
  presenceListeners.add(listener);
  return () => presenceListeners.delete(listener);
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
