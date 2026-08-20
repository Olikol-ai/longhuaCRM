import { PenSquare } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { chatsApi } from '@/api/chats.api';
import ChatComposer from '@/components/chats/ChatComposer';
import ChatForwardDialog from '@/components/chats/ChatForwardDialog';
import ChatInfoPanel from '@/components/chats/ChatInfoPanel';
import ChatMessagePane from '@/components/chats/ChatMessagePane';
import ChatSidebar from '@/components/chats/ChatSidebar';
import DmRequestsPanel from '@/components/chats/DmRequestsPanel';
import E2eeUnlockDialog from '@/components/chats/E2eeUnlockDialog';
import FindInterlocutorDialog from '@/components/chats/FindInterlocutorDialog';
import { Fab, Sheet, SheetContent } from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useE2ee } from '@/lib/e2ee/E2eeContext';
import { useIsLgUp } from '@/lib/responsive';
import {
  messageCreatedAtMs,
  normalizeChat,
  normalizeChatGroups,
  normalizeMessage,
  normalizeMessages,
  pickField,
} from '@/lib/chat-normalize';
import {
  connectChatSocket,
  emitMessageRead,
  joinChat,
  leaveChat,
  onPresenceEvent,
  subscribeToChatSocket,
} from '@/lib/chat-socket';
import {
  applyUnreadSummaryFromSocket,
  getCachedUnreadSummary,
  refreshChatUnread,
  subscribeUnreadSummary,
} from '@/lib/chat-unread-sync';
import { OfflineSnapshotBanner } from '@/components/pwa/OfflineSnapshotBanner';
import { resolveKeyboardInset } from '@/lib/chat/composer-layout';
import {
  CHAT_MESSAGE_CAP,
  OFFLINE_RESOURCES,
  putSnapshot,
  readWithOfflineFallback,
  sanitizeChatMessages,
  isOfflineMode,
} from '@/lib/offline';
import { previewFromMessage } from '@/lib/chat/preview';
import { isReactionBody } from '@/lib/chat/reactions';
import { buildChatTextPayload } from '@/lib/chat/send-payload';
import {
  clearLegacyLocalChatPrefs,
  isChatArchived,
  isChatFavorite,
  isChatMuted,
  isChatPinned,
  normalizeUserState,
  patchChatInGroups,
} from '@/lib/chat/prefs';

const emptyGroups = {};
const PAGE_SIZE = 50;

function toChronological(listedNewestFirst) {
  return [...normalizeMessages(listedNewestFirst)].reverse();
}

function upsertMessage(list, message) {
  const next = normalizeMessage(message);
  if (!next?.id) return list || [];
  const previous = list || [];
  const existing = previous.findIndex((item) => item.id === next.id);
  if (existing === -1) {
    return [...previous, next].sort((a, b) => messageCreatedAtMs(a) - messageCreatedAtMs(b));
  }
  return previous.map((item) => (item.id === next.id ? { ...item, ...next } : item));
}

function patchUnread(groups, chatId, unreadCount) {
  return Object.fromEntries(
    Object.entries(groups).map(([kind, chats]) => [
      kind,
      chats.map((chat) =>
        chat.id === chatId ? normalizeChat({ ...chat, unreadCount }) : chat,
      ),
    ]),
  );
}

export default function Chats() {
  const { user } = useAuth();
  const { ready: e2eeReady, locked: e2eeLocked, missing: e2eeMissing } = useE2ee();
  const isLgUp = useIsLgUp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState(emptyGroups);
  const [activeChat, setActiveChat] = useState(null);
  const [mobilePane, setMobilePane] = useState('list');
  const [messagesByChat, setMessagesByChat] = useState({});
  const [historyStatusByChat, setHistoryStatusByChat] = useState({});
  const [historyErrorByChat, setHistoryErrorByChat] = useState({});
  const [hasMoreByChat, setHasMoreByChat] = useState({});
  const [members, setMembers] = useState([]);
  const [pins, setPins] = useState([]);
  const [typingByChat, setTypingByChat] = useState({});
  const [previewByChat, setPreviewByChat] = useState({});
  const [infoOpen, setInfoOpen] = useState(false);
  const [desktopAsideOpen, setDesktopAsideOpen] = useState(true);
  const [finderOpen, setFinderOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(searchParams.get('tab') === 'requests');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [e2eeUnlockOpen, setE2eeUnlockOpen] = useState(false);
  const [offlineMeta, setOfflineMeta] = useState({ fromCache: false, updatedAt: null, missing: false });
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [forward, setForward] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const activeChatIdRef = useRef(null);
  activeChatIdRef.current = activeChat?.id || null;
  const markReadRequestRef = useRef(0);
  const isLgUpRef = useRef(isLgUp);
  isLgUpRef.current = isLgUp;
  const initialChatIdRef = useRef(searchParams.get('chatId'));

  useEffect(() => {
    if (activeChat?.kind === 'direct' && (e2eeLocked || e2eeMissing) && !e2eeReady) {
      setE2eeUnlockOpen(true);
    }
  }, [activeChat?.id, activeChat?.kind, e2eeLocked, e2eeMissing, e2eeReady]);

  // Mobile immersive messenger: hide CRM chrome while a conversation is open.
  useEffect(() => {
    const immersive = !isLgUp && mobilePane === 'chat' && Boolean(activeChat?.id);
    if (immersive) {
      document.documentElement.setAttribute('data-lh-mobile-chat', '');
    } else {
      document.documentElement.removeAttribute('data-lh-mobile-chat');
    }
    return () => {
      document.documentElement.removeAttribute('data-lh-mobile-chat');
    };
  }, [isLgUp, mobilePane, activeChat?.id]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    let baseline = Math.max(window.innerHeight, vv.height + (vv.offsetTop || 0));
    const sync = () => {
      const resolved = resolveKeyboardInset({
        baseline,
        innerHeight: window.innerHeight,
        viewportHeight: vv.height,
        offsetTop: vv.offsetTop,
      });
      baseline = resolved.baseline;
      const inset = resolved.inset;
      document.documentElement.style.setProperty('--lh-kbd-inset', `${inset}px`);
      document.documentElement.style.setProperty('--lh-vv-height', `${Math.round(vv.height)}px`);
      if (inset > 24) {
        document.documentElement.setAttribute('data-lh-kbd-open', '');
        const canvas = document.querySelector('[data-chat-canvas]');
        if (canvas) {
          const nearBottom = canvas.scrollHeight - canvas.scrollTop - canvas.clientHeight < 120;
          if (nearBottom) {
            requestAnimationFrame(() => {
              canvas.scrollTop = canvas.scrollHeight;
            });
          }
        }
      } else {
        document.documentElement.removeAttribute('data-lh-kbd-open');
      }
    };
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    window.addEventListener('orientationchange', sync);
    sync();
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      window.removeEventListener('orientationchange', sync);
      document.documentElement.style.removeProperty('--lh-kbd-inset');
      document.documentElement.style.removeProperty('--lh-vv-height');
      document.documentElement.removeAttribute('data-lh-kbd-open');
    };
  }, []);

  const activeChatId = activeChat?.id || null;
  const messages = activeChatId ? messagesByChat[activeChatId] || [] : [];
  const historyStatus = activeChatId ? historyStatusByChat[activeChatId] || 'idle' : 'idle';
  const historyError = activeChatId ? historyErrorByChat[activeChatId] || null : null;
  const hasMoreOlder = activeChatId ? hasMoreByChat[activeChatId] !== false : false;
  const typingUserIds = activeChatId ? typingByChat[activeChatId] || [] : [];
  const offline = offlineMeta.fromCache || isOfflineMode();

  const rememberPreview = useCallback((chatId, message) => {
    if (!chatId || !message) return;
    if (message.replyToMessageId && isReactionBody(message.body)) return;
    const preview = previewFromMessage(message);
    setPreviewByChat((prev) => {
      const current = prev[chatId];
      if (current && current.at > preview.at) return prev;
      return { ...prev, [chatId]: preview };
    });
  }, []);

  const loadChats = useCallback(async (preferredChatId) => {
    if (!user?.id) return;
    clearLegacyLocalChatPrefs();
    const result = await readWithOfflineFallback({
      userId: user.id,
      role: user.role || 'unknown',
      resource: OFFLINE_RESOURCES.CHATS_LIST,
      resourceKey: 'groups',
      fetcher: async () => {
        const data = await chatsApi.list();
        return { groups: normalizeChatGroups(data.groups || {}) };
      },
    });
    setOfflineMeta({
      fromCache: result.fromCache,
      updatedAt: result.updatedAt,
      missing: result.missing,
    });
    const nextGroups = result.data?.groups || emptyGroups;
    setGroups(nextGroups);
    setActiveChat((current) => {
      const allChats = Object.values(nextGroups).flat();
      if (preferredChatId) {
        const found = allChats.find((chat) => chat.id === preferredChatId);
        if (found && !isLgUpRef.current) setMobilePane('chat');
        return found || current;
      }
      if (current?.id) {
        return allChats.find((chat) => chat.id === current.id) || current;
      }
      if (isLgUpRef.current) return allChats[0] || null;
      return null;
    });
  }, [user?.id, user?.role]);

  const loadPendingCount = useCallback(async () => {
    try {
      const incoming = await chatsApi.listIncomingDmRequests({ status: 'pending' });
      setPendingRequestsCount(Array.isArray(incoming) ? incoming.length : 0);
    } catch {
      setPendingRequestsCount(0);
    }
  }, []);

  const applyByChatToGroups = useCallback((byChat) => {
    const openChatId = activeChatIdRef.current;
    const map = byChat && typeof byChat === 'object' ? byChat : {};
    setGroups((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([kind, chats]) => [
          kind,
          chats.map((chat) => {
            const unreadCount =
              chat.id === openChatId ? 0 : map?.[chat.id] || 0;
            return normalizeChat({
              ...chat,
              unreadCount,
            });
          }),
        ]),
      ),
    );
  }, []);

  const syncUnreadFromServer = useCallback(async (options = {}) => {
    const summary = await refreshChatUnread(options);
    if (!summary) return;
    applyByChatToGroups(summary.byChat);
  }, [applyByChatToGroups]);

  useEffect(() => {
    void loadChats(initialChatIdRef.current || undefined).finally(() => setLoading(false));
    void loadPendingCount();
  }, [loadChats, loadPendingCount]);

  useEffect(() => {
    connectChatSocket();
  }, []);

  // After realtime drop / PWA resume — re-fetch canonical member prefs from DB.
  useEffect(() => {
    const refreshPrefs = () => {
      void loadChats(activeChatIdRef.current || undefined);
    };
    const unsubPresence = onPresenceEvent((event) => {
      if (event === 'socket.reconnect') refreshPrefs();
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshPrefs();
    };
    const onOnline = () => refreshPrefs();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      unsubPresence();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [loadChats]);

  useEffect(() => {
    void syncUnreadFromServer({ force: true });
    return subscribeUnreadSummary((summary) => {
      applyByChatToGroups(summary.byChat);
    });
  }, [syncUnreadFromServer, applyByChatToGroups]);

  const loadHistory = useCallback(async (chatId) => {
    if (!chatId || !user?.id) return;
    setHistoryStatusByChat((prev) => ({ ...prev, [chatId]: 'loading' }));
    setHistoryErrorByChat((prev) => ({ ...prev, [chatId]: null }));
    try {
      const result = await readWithOfflineFallback({
        userId: user.id,
        role: user.role || 'unknown',
        resource: OFFLINE_RESOURCES.CHAT_MESSAGES,
        resourceKey: String(chatId),
        fetcher: async () => {
          const listedMessages = await chatsApi.messages(chatId, { limit: PAGE_SIZE });
          const chronological = toChronological(listedMessages);
          return {
            messages: sanitizeChatMessages(chronological, CHAT_MESSAGE_CAP),
            hasMore: Array.isArray(listedMessages) && listedMessages.length >= PAGE_SIZE,
          };
        },
      });
      const chronological = result.data?.messages || [];
      setMessagesByChat((prev) => ({ ...prev, [chatId]: chronological }));
      const last = [...chronological].reverse().find(
        (message) => !(message.replyToMessageId && isReactionBody(message.body)),
      );
      if (last) rememberPreview(chatId, last);
      setHasMoreByChat((prev) => ({
        ...prev,
        [chatId]: result.fromCache ? false : Boolean(result.data?.hasMore),
      }));
      setHistoryStatusByChat((prev) => ({ ...prev, [chatId]: 'ready' }));
      if (result.fromCache) {
        setOfflineMeta((prev) => ({
          ...prev,
          fromCache: true,
          updatedAt: result.updatedAt || prev.updatedAt,
        }));
      }
    } catch (err) {
      setHistoryStatusByChat((prev) => ({ ...prev, [chatId]: 'error' }));
      setHistoryErrorByChat((prev) => ({
        ...prev,
        [chatId]: err?.message || 'Ошибка загрузки',
      }));
      if (activeChatIdRef.current === chatId) {
        toast({
          title: 'Не удалось загрузить историю',
          description: err?.message,
          variant: 'destructive',
        });
      }
    }
  }, [user?.id, user?.role, rememberPreview]);

  useEffect(() => {
    if (!activeChatId) {
      setMembers([]);
      setPins([]);
      return undefined;
    }

    joinChat(activeChatId);
    void loadHistory(activeChatId);

    void chatsApi
      .members(activeChatId)
      .then((rows) => {
        if (activeChatIdRef.current === activeChatId) {
          setMembers(Array.isArray(rows) ? rows : []);
        }
      })
      .catch(() => {
        if (activeChatIdRef.current === activeChatId) setMembers([]);
      });

    void chatsApi
      .pins(activeChatId)
      .then((rows) => {
        if (activeChatIdRef.current === activeChatId) {
          setPins(Array.isArray(rows) ? rows : []);
        }
      })
      .catch(() => {
        if (activeChatIdRef.current === activeChatId) setPins([]);
      });

    return () => {
      leaveChat(activeChatId);
    };
  }, [activeChatId, loadHistory]);

  useEffect(() => {
    setReplyTo(null);
    setEditing(null);
    setSelectedIds(new Set());
  }, [activeChatId]);

  const applyMemberPrefs = useCallback((chatId, userState) => {
    const normalized = normalizeUserState(userState);
    setGroups((prev) => {
      const next = patchChatInGroups(prev, chatId, normalized);
      // Keep offline snapshot aligned with server SSOT so F5 cannot resurrect stale Active.
      if (user?.id) {
        void putSnapshot({
          userId: user.id,
          role: user.role || 'unknown',
          resource: OFFLINE_RESOURCES.CHATS_LIST,
          resourceKey: 'groups',
          data: { groups: next },
          source: 'member_prefs',
        });
      }
      return next;
    });
    setActiveChat((current) =>
      current?.id === chatId
        ? normalizeChat({ ...current, userState: normalized })
        : current,
    );
  }, [user?.id, user?.role]);

  const onToggleMemberPref = useCallback(
    async (chat, action) => {
      if (!chat?.id) return;

      if (action === 'mark_unread') {
        try {
          const result = await chatsApi.markUnread(chat.id);
          const unread = pickField(result, 'unreadCount', 'unread_count');
          setGroups((prev) =>
            patchUnread(prev, chat.id, typeof unread === 'number' ? unread : 1),
          );
        } catch (err) {
          toast({
            title: 'Не удалось пометить чат',
            description: err?.message || 'Попробуйте ещё раз',
            variant: 'destructive',
          });
        }
        return;
      }

      const state = normalizeUserState(chat);
      let patch = null;
      if (action === 'pin') patch = { pinned: !isChatPinned(chat) };
      else if (action === 'mute') patch = { muted: !isChatMuted(chat) };
      else if (action === 'favorite') patch = { favorite: !isChatFavorite(chat) };
      else if (action === 'archive') patch = { archived: !isChatArchived(chat) };
      if (!patch) return;

      const optimistic = { ...state, ...patch };
      applyMemberPrefs(chat.id, optimistic);
      try {
        const saved =
          action === 'archive' && patch.archived
            ? await chatsApi.archiveChat(chat.id)
            : action === 'archive' && !patch.archived
              ? await chatsApi.unarchiveChat(chat.id)
              : await chatsApi.updateMemberPrefs(chat.id, patch);
        // Always trust API body — never leave optimistic patch as truth.
        // applyMemberPrefs also writes the offline snapshot (F5 SSOT).
        applyMemberPrefs(chat.id, saved || optimistic);
      } catch (err) {
        applyMemberPrefs(chat.id, state);
        toast({
          title: 'Не удалось обновить чат',
          description: err?.message || 'Попробуйте ещё раз',
          variant: 'destructive',
        });
      }
    },
    [applyMemberPrefs],
  );

  useEffect(
    () =>
      subscribeToChatSocket({
        'message.created': (message) => {
          const next = normalizeMessage(message);
          if (!next?.chatId) return;
          setMessagesByChat((prev) => ({
            ...prev,
            [next.chatId]: upsertMessage(prev[next.chatId], next),
          }));
          rememberPreview(next.chatId, next);
          if (next.chatId === activeChatIdRef.current) {
            setHistoryStatusByChat((prev) => ({ ...prev, [next.chatId]: 'ready' }));
            setGroups((prev) => patchUnread(prev, next.chatId, 0));
            if (next.id && next.senderUserId !== user?.id) {
              void chatsApi
                .markRead(next.chatId)
                .then(() => {
                  emitMessageRead(next.chatId, next.id);
                })
                .catch(() => {});
            }
          } else {
            setGroups((prev) => {
              const chat = Object.values(prev)
                .flat()
                .find((item) => item.id === next.chatId);
              const current = chat?.unreadCount || 0;
              return patchUnread(prev, next.chatId, current + 1);
            });
          }
        },
        'chat.unread': (payload) => {
          const summary = applyUnreadSummaryFromSocket(payload);
          applyByChatToGroups(summary.byChat);
        },
        'message.updated': (message) => {
          const next = normalizeMessage(message);
          if (!next?.chatId) return;
          setMessagesByChat((prev) => ({
            ...prev,
            [next.chatId]: upsertMessage(prev[next.chatId], next),
          }));
          rememberPreview(next.chatId, next);
        },
        'message.deleted': (payload) => {
          const chatId = pickField(payload, 'chatId', 'chat_id');
          const messageId = pickField(payload, 'messageId', 'message_id');
          if (!chatId || !messageId) return;
          setMessagesByChat((prev) => ({
            ...prev,
            [chatId]: (prev[chatId] || []).filter((message) => message.id !== messageId),
          }));
        },
        'typing.start': (payload) => {
          const chatId = pickField(payload, 'chatId', 'chat_id');
          const userId = pickField(payload, 'userId', 'user_id');
          if (!chatId || !userId || userId === user?.id) return;
          setTypingByChat((previous) => ({
            ...previous,
            [chatId]: [...new Set([...(previous[chatId] || []), userId])],
          }));
        },
        'typing.stop': (payload) => {
          const chatId = pickField(payload, 'chatId', 'chat_id');
          const userId = pickField(payload, 'userId', 'user_id');
          if (!chatId || !userId) return;
          setTypingByChat((previous) => ({
            ...previous,
            [chatId]: (previous[chatId] || []).filter((id) => id !== userId),
          }));
        },
        'chat.request.created': () => {
          void loadPendingCount();
        },
        'chat.request.accepted': (payload) => {
          void loadPendingCount();
          void loadChats(
            pickField(payload?.chat, 'id') ||
              pickField(payload, 'createdChatId', 'created_chat_id'),
          );
        },
        'chat.created': (chat) => {
          void loadChats(chat?.id);
        },
        'chat.deleted': (payload) => {
          const chatId = pickField(payload, 'chatId', 'chat_id');
          if (activeChatIdRef.current === chatId) setActiveChat(null);
          void loadChats();
        },
        'chat.member_prefs': (payload) => {
          const chatId = pickField(payload, 'chatId', 'chat_id');
          const userState = payload?.userState || payload?.user_state;
          if (!chatId || !userState) return;
          applyMemberPrefs(chatId, userState);
        },
      }),
    [loadChats, loadPendingCount, user?.id, applyByChatToGroups, rememberPreview, applyMemberPrefs],
  );

  const selectChat = useCallback((chat) => {
    setActiveChat(normalizeChat(chat));
    setMobilePane('chat');
    setRequestsOpen(false);
    setInfoOpen(false);
    if (chat?.id) {
      setSearchParams({ chatId: chat.id }, { replace: true });
    }
  }, [setSearchParams]);

  const backToChatList = useCallback(() => {
    setMobilePane('list');
    setInfoOpen(false);
    if (!isLgUp) setActiveChat(null);
    setSearchParams({}, { replace: true });
  }, [isLgUp, setSearchParams]);

  const onMarkRead = useCallback(
    (messageId) => {
      const chatId = activeChatIdRef.current;
      if (!chatId) return;
      const requestId = ++markReadRequestRef.current;
      setGroups((prev) => patchUnread(prev, chatId, 0));
      void chatsApi
        .markRead(chatId, messageId || undefined)
        .then((result) => {
          if (requestId !== markReadRequestRef.current) return;
          if (activeChatIdRef.current !== chatId) return;
          const lastReadId =
            pickField(result, 'lastReadMessageId', 'last_read_message_id') || messageId;
          if (lastReadId) emitMessageRead(chatId, lastReadId);
          const unread = pickField(result, 'unreadCount', 'unread_count');
          const nextUnread = typeof unread === 'number' ? unread : 0;
          setGroups((prev) => patchUnread(prev, chatId, nextUnread));
          // Keep shared unread cache in sync — stale subscribeUnreadSummary must not
          // resurrect badges after a successful read (mobile back → desktop list).
          const cached = getCachedUnreadSummary() || { total: 0, byChat: {} };
          const byChat = { ...(cached.byChat || {}) };
          if (nextUnread > 0) byChat[chatId] = nextUnread;
          else delete byChat[chatId];
          const total = Object.values(byChat).reduce(
            (sum, value) => sum + (Number(value) || 0),
            0,
          );
          applyUnreadSummaryFromSocket({ total, byChat });
        })
        .catch(() => {
          if (requestId !== markReadRequestRef.current) return;
          void syncUnreadFromServer({ force: true });
        });
    },
    [syncUnreadFromServer],
  );

  const loadOlderMessages = useCallback(async () => {
    const chatId = activeChatIdRef.current;
    if (!chatId || loadingOlder) return;
    if (hasMoreByChat[chatId] === false) return;
    const current = messagesByChat[chatId] || [];
    const oldest = current[0];
    if (!oldest?.id) return;
    setLoadingOlder(true);
    try {
      const listed = await chatsApi.messages(chatId, {
        limit: PAGE_SIZE,
        before: oldest.id,
      });
      if (activeChatIdRef.current !== chatId) return;
      const older = toChronological(listed);
      setHasMoreByChat((prev) => ({
        ...prev,
        [chatId]: Array.isArray(listed) && listed.length >= PAGE_SIZE,
      }));
      if (older.length) {
        setMessagesByChat((prev) => {
          const existing = prev[chatId] || [];
          const ids = new Set(existing.map((item) => item.id));
          const merged = [...older.filter((item) => !ids.has(item.id)), ...existing];
          return {
            ...prev,
            [chatId]: merged.sort((a, b) => messageCreatedAtMs(a) - messageCreatedAtMs(b)),
          };
        });
      }
    } catch (err) {
      toast({
        title: 'Не удалось подгрузить сообщения',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMoreByChat, loadingOlder, messagesByChat]);

  const addMessage = (message) => {
    const next = normalizeMessage(message);
    if (!next?.chatId) return;
    setMessagesByChat((prev) => ({
      ...prev,
      [next.chatId]: upsertMessage(prev[next.chatId], next),
    }));
    setHistoryStatusByChat((prev) => ({ ...prev, [next.chatId]: 'ready' }));
    rememberPreview(next.chatId, next);
  };

  const onAttachmentUploaded = (payload) => {
    const message =
      normalizeMessage(pickField(payload, 'message')) ||
      normalizeMessage(payload);
    if (message?.chatId) {
      addMessage(message);
      return;
    }
    const chatId = activeChatIdRef.current;
    if (chatId) void loadHistory(chatId);
  };

  const pin = async (messageId) => {
    if (!activeChatId) return;
    await chatsApi.pin(activeChatId, messageId);
    setPins(await chatsApi.pins(activeChatId));
  };

  const unpin = async (messageId) => {
    if (!activeChatId) return;
    await chatsApi.unpin(activeChatId, messageId);
    setPins((previous) =>
      previous.filter(
        (pinItem) => pickField(pinItem, 'messageId', 'message_id') !== messageId,
      ),
    );
  };

  const hideChat = async () => {
    if (!activeChatId) return;
    try {
      await chatsApi.hideMembership(activeChatId);
      toast({ title: 'Чат скрыт у вас' });
      setActiveChat(null);
      setMobilePane('list');
      void loadChats();
    } catch (err) {
      toast({ title: 'Не удалось скрыть', description: err?.message, variant: 'destructive' });
    }
  };

  const sendReaction = async (parentId, emoji) => {
    if (!activeChatId || !emoji) return;
    if (activeChat?.kind === 'direct' && !e2eeReady) {
      setE2eeUnlockOpen(true);
      return;
    }
    try {
      const payload = await buildChatTextPayload({
        chat: activeChat,
        userId: user?.id,
        text: emoji,
        replyToMessageId: parentId,
      });
      const message = await chatsApi.sendMessage(activeChatId, payload);
      addMessage(message);
    } catch (err) {
      toast({
        title: 'Не удалось поставить реакцию',
        description: err?.message,
        variant: 'destructive',
      });
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await chatsApi.deleteMessage(messageId);
      setMessagesByChat((prev) => ({
        ...prev,
        [activeChatId]: (prev[activeChatId] || []).filter((item) => item.id !== messageId),
      }));
    } catch (err) {
      toast({ title: 'Не удалось удалить', description: err?.message, variant: 'destructive' });
    }
  };

  const openRequests = () => {
    setRequestsOpen(true);
    setDesktopAsideOpen(true);
    setSearchParams({ tab: 'requests' });
  };

  const closeRequests = () => {
    setRequestsOpen(false);
    setSearchParams({});
  };

  const openDesktopInfo = () => {
    setRequestsOpen(false);
    setDesktopAsideOpen(true);
    if (!isLgUp) setInfoOpen(true);
  };

  const closeDesktopAside = () => {
    setDesktopAsideOpen(false);
    setRequestsOpen(false);
    setSearchParams({});
  };

  const showDesktopAside = isLgUp && (requestsOpen || desktopAsideOpen);
  const newsLocked = activeChat?.kind === 'school_news' && user?.role !== 'admin';

  const sidebar = useMemo(
    () => (
      <ChatSidebar
        groups={groups}
        activeChatId={activeChatId}
        onSelect={selectChat}
        onFindInterlocutor={() => setFinderOpen(true)}
        onOpenRequests={openRequests}
        currentUserId={user?.id}
        pendingRequestsCount={pendingRequestsCount}
        previewByChat={previewByChat}
        typingByChat={typingByChat}
        onToggleMemberPref={onToggleMemberPref}
      />
    ),
    [
      groups,
      activeChatId,
      pendingRequestsCount,
      user?.id,
      previewByChat,
      typingByChat,
      selectChat,
      onToggleMemberPref,
    ],
  );

  return (
    <div className="lh-chat-shell min-h-0 max-w-full overflow-x-hidden overflow-y-hidden lg:h-app lg:max-h-none">
      {(offlineMeta.fromCache || isOfflineMode()) ? (
        <div className="px-3 py-2">
          <OfflineSnapshotBanner
            fromCache={offlineMeta.fromCache || isOfflineMode()}
            updatedAt={offlineMeta.updatedAt}
            missing={offlineMeta.missing}
            emptyLabel="Нет подключения · чаты недоступны без сохранённых данных"
          />
          {offlineMeta.fromCache ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Нет подключения · показаны последние сообщения. Отправка недоступна.
            </p>
          ) : null}
        </div>
      ) : null}
      <div
        className={
          showDesktopAside
            ? 'grid h-full min-w-0 max-w-full grid-cols-1 overflow-x-hidden lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)_minmax(17rem,20rem)] xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)_minmax(18rem,22rem)]'
            : 'grid h-full min-w-0 max-w-full grid-cols-1 overflow-x-hidden lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]'
        }
        data-testid="chat-2-shell"
        data-aside={showDesktopAside ? (requestsOpen ? 'requests' : 'info') : 'closed'}
      >
        <aside className="hidden min-h-0 min-w-0 overflow-hidden border-r border-border/50 lg:block">{sidebar}</aside>

        <section
          className={`relative min-h-0 flex-col ${
            isLgUp || mobilePane === 'list' ? 'flex' : 'hidden'
          } lg:hidden`}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Загрузка чатов…
            </div>
          ) : (
            sidebar
          )}
          <Fab
            label="Новый чат"
            className="lg:hidden bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] transition-transform active:scale-95"
            onClick={() => setFinderOpen(true)}
          >
            <PenSquare />
          </Fab>
        </section>

        <section
          className={`lh-chat-pane min-h-0 min-w-0 flex-col overflow-hidden ${
            isLgUp || mobilePane === 'chat' ? 'flex' : 'hidden'
          }`}
          data-lh-chat-pane
        >
          {loading && isLgUp ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Загрузка чатов…
            </div>
          ) : (
            <>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <ChatMessagePane
                  chat={activeChat}
                  messages={messages}
                  typingUserIds={typingUserIds}
                  currentUserId={user?.id}
                  members={members}
                  pins={pins}
                  historyStatus={historyStatus}
                  historyError={historyError}
                  loadingOlder={loadingOlder}
                  hasMoreOlder={hasMoreOlder}
                  enableSwipeBack={!isLgUp}
                  onLoadOlder={() => void loadOlderMessages()}
                  onRefresh={() => {
                    if (activeChatId) void loadHistory(activeChatId);
                  }}
                  onBack={!isLgUp ? backToChatList : undefined}
                  onOpenInfo={openDesktopInfo}
                  onPin={(messageId) => void pin(messageId)}
                  onMarkRead={onMarkRead}
                  onNeedUnlock={() => setE2eeUnlockOpen(true)}
                  onReply={(message, text) => {
                    setEditing(null);
                    setReplyTo({
                      id: message.id,
                      preview: text || previewFromMessage(message).text,
                    });
                  }}
                  onEdit={(message, text) => {
                    setReplyTo(null);
                    setEditing({ id: message.id, body: text || '' });
                  }}
                  onForward={(message, text) => setForward({ message, text })}
                  onReact={(messageId, emoji) => sendReaction(messageId, emoji)}
                  onDelete={(messageId) => deleteMessage(messageId)}
                  selectedIds={selectedIds}
                  onToggleSelect={(id) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                  onClearSelection={() => setSelectedIds(new Set())}
                />
              </div>
              {activeChat ? (
                <div className="shrink-0">
                  <ChatComposer
                    chat={activeChat}
                    disabled={newsLocked || offline}
                    disabledReason={
                      offline
                        ? 'Нет подключения · отправка недоступна.'
                        : undefined
                    }
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                    editing={editing}
                    onCancelEdit={() => setEditing(null)}
                    onMessageCreated={addMessage}
                    onMessageUpdated={addMessage}
                    onAttachmentUploaded={onAttachmentUploaded}
                    onNeedUnlock={() => setE2eeUnlockOpen(true)}
                  />
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside
          className={`min-h-0 min-w-0 overflow-hidden border-l border-border/50 ${showDesktopAside ? 'hidden lg:block' : 'hidden'}`}
        >
          {requestsOpen ? (
            <DmRequestsPanel
              open
              onClose={closeDesktopAside}
              onAccepted={(accepted) => {
                const chatId = pickField(accepted, 'createdChatId', 'created_chat_id');
                void loadChats(chatId);
                closeRequests();
              }}
            />
          ) : (
            <ChatInfoPanel
              chat={activeChat}
              members={members}
              pins={pins}
              messages={messages}
              currentUserId={user?.id}
              onClose={closeDesktopAside}
              onUnpin={(messageId) => void unpin(messageId)}
              onHide={() => void hideChat()}
              onJumpMessage={(id) => {
                document.getElementById(`msg-${id}`)?.scrollIntoView({ block: 'center' });
              }}
            />
          )}
        </aside>
      </div>

      <Sheet open={infoOpen && !isLgUp} onOpenChange={setInfoOpen}>
        <SheetContent
          side="bottom"
          showClose={false}
          className="h-[min(88dvh,100%)] max-h-[88dvh] rounded-t-2xl p-0 safe-pb"
        >
          <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-muted" aria-hidden />
          {requestsOpen ? (
            <DmRequestsPanel
              open
              onClose={closeRequests}
              onAccepted={(accepted) => {
                const chatId = pickField(accepted, 'createdChatId', 'created_chat_id');
                void loadChats(chatId);
                closeRequests();
                setInfoOpen(false);
              }}
            />
          ) : (
            <ChatInfoPanel
              chat={activeChat}
              members={members}
              pins={pins}
              messages={messages}
              currentUserId={user?.id}
              onUnpin={(messageId) => void unpin(messageId)}
              onHide={() => void hideChat()}
              onJumpMessage={(id) => {
                setInfoOpen(false);
                document.getElementById(`msg-${id}`)?.scrollIntoView({ block: 'center' });
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={requestsOpen && !isLgUp && mobilePane === 'list'}
        onOpenChange={(open) => {
          if (!open) closeRequests();
          else setRequestsOpen(true);
        }}
      >
        <SheetContent
          side="bottom"
          showClose={false}
          className="h-[min(88dvh,100%)] rounded-t-2xl p-0 safe-pb"
        >
          <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-muted" aria-hidden />
          <DmRequestsPanel
            open
            onClose={closeRequests}
            onAccepted={(accepted) => {
              const chatId = pickField(accepted, 'createdChatId', 'created_chat_id');
              void loadChats(chatId);
              closeRequests();
            }}
          />
        </SheetContent>
      </Sheet>

      <FindInterlocutorDialog
        open={finderOpen}
        onOpenChange={setFinderOpen}
        onRequestSent={() => {
          void loadPendingCount();
          openRequests();
        }}
      />

      <E2eeUnlockDialog open={e2eeUnlockOpen} onOpenChange={setE2eeUnlockOpen} />

      <ChatForwardDialog
        open={Boolean(forward)}
        onOpenChange={(open) => {
          if (!open) setForward(null);
        }}
        groups={groups}
        message={forward?.message}
        decryptedBody={forward?.text}
      />
    </div>
  );
}
