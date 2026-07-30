import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  connectChatSocket,
  disconnectChatSocket,
  onPresenceEvent,
} from '@/lib/chat-socket';

const PresenceContext = createContext(null);

function pickUserId(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload.userId || payload.user_id || null;
}

export function PresenceProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());

  const replaceOnline = useCallback((ids) => {
    setOnlineUserIds(new Set((ids || []).filter(Boolean)));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectChatSocket();
      setOnlineUserIds(new Set());
      return undefined;
    }

    connectChatSocket();
    return onPresenceEvent((event, payload) => {
      if (event === 'presence.sync') {
        const ids = payload?.onlineUserIds || payload?.online_user_ids || [];
        replaceOnline(Array.isArray(ids) ? ids : []);
        return;
      }
      if (event === 'user.online') {
        const userId = pickUserId(payload);
        if (!userId) return;
        setOnlineUserIds((prev) => {
          if (prev.has(userId)) return prev;
          const next = new Set(prev);
          next.add(userId);
          return next;
        });
        return;
      }
      if (event === 'user.offline') {
        const userId = pickUserId(payload);
        if (!userId) return;
        setOnlineUserIds((prev) => {
          if (!prev.has(userId)) return prev;
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    });
  }, [isAuthenticated, replaceOnline]);

  const isUserOnline = useCallback(
    (userId) => Boolean(userId && onlineUserIds.has(userId)),
    [onlineUserIds],
  );

  const countOnlineAmong = useCallback(
    (userIds) => {
      if (!Array.isArray(userIds) || !userIds.length) return 0;
      let count = 0;
      for (const id of userIds) {
        if (onlineUserIds.has(id)) count += 1;
      }
      return count;
    },
    [onlineUserIds],
  );

  const value = useMemo(
    () => ({
      onlineUserIds,
      isUserOnline,
      countOnlineAmong,
    }),
    [onlineUserIds, isUserOnline, countOnlineAmong],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider');
  return ctx;
}
