import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { chatsApi } from '@/api/chats.api';
import ChatComposer from '@/components/chats/ChatComposer';
import ChatInfoPanel from '@/components/chats/ChatInfoPanel';
import ChatMessagePane from '@/components/chats/ChatMessagePane';
import ChatSidebar from '@/components/chats/ChatSidebar';
import DmRequestsPanel from '@/components/chats/DmRequestsPanel';
import E2eeUnlockDialog from '@/components/chats/E2eeUnlockDialog';
import FindInterlocutorDialog from '@/components/chats/FindInterlocutorDialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
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
  disconnectChatSocket,
  emitMessageRead,
  joinChat,
  leaveChat,
  subscribeToChatSocket,
} from '@/lib/chat-socket';

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
  /** Mobile single-pane: list | chat (info is a sheet). */
  const [mobilePane, setMobilePane] = useState('list');
  /** @type {[Record<string, Array>, Function]} */
  const [messagesByChat, setMessagesByChat] = useState({});
  /** @type {[Record<string, 'idle'|'loading'|'ready'|'error'>, Function]} */
  const [historyStatusByChat, setHistoryStatusByChat] = useState({});
  /** @type {[Record<string, string|null>, Function]} */
  const [historyErrorByChat, setHistoryErrorByChat] = useState({});
  /** @type {[Record<string, boolean>, Function]} */
  const [hasMoreByChat, setHasMoreByChat] = useState({});
  const [members, setMembers] = useState([]);
  const [pins, setPins] = useState([]);
  const [typingUserIds, setTypingUserIds] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(searchParams.get('tab') === 'requests');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [e2eeUnlockOpen, setE2eeUnlockOpen] = useState(false);

  const activeChatIdRef = useRef(null);
  activeChatIdRef.current = activeChat?.id || null;
  const isLgUpRef = useRef(isLgUp);
  isLgUpRef.current = isLgUp;

  useEffect(() => {
    if (activeChat?.kind === 'direct' && (e2eeLocked || e2eeMissing) && !e2eeReady) {
      setE2eeUnlockOpen(true);
    }
  }, [activeChat?.id, activeChat?.kind, e2eeLocked, e2eeMissing, e2eeReady]);

  const activeChatId = activeChat?.id || null;
  const messages = activeChatId ? messagesByChat[activeChatId] || [] : [];
  const historyStatus = activeChatId ? historyStatusByChat[activeChatId] || 'idle' : 'idle';
  const historyError = activeChatId ? historyErrorByChat[activeChatId] || null : null;
  const hasMoreOlder = activeChatId ? hasMoreByChat[activeChatId] !== false : false;

  const loadChats = useCallback(async (preferredChatId) => {
    const data = await chatsApi.list();
    const nextGroups = normalizeChatGroups(data.groups || {});
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
      // Desktop auto-selects first chat; mobile stays on the list.
      if (isLgUpRef.current) return allChats[0] || null;
      return null;
    });
  }, []);

  const loadPendingCount = useCallback(async () => {
    try {
      const incoming = await chatsApi.listIncomingDmRequests({ status: 'pending' });
      setPendingRequestsCount(Array.isArray(incoming) ? incoming.length : 0);
    } catch {
      setPendingRequestsCount(0);
    }
  }, []);

  const refreshUnreadBadges = useCallback(() => {
    void chatsApi
      .unreadCount()
      .then((summary) => {
        const byChat = pickField(summary, 'byChat', 'by_chat') || {};
        setGroups((previous) =>
          Object.fromEntries(
            Object.entries(previous).map(([kind, chats]) => [
              kind,
              chats.map((chat) =>
                normalizeChat({
                  ...chat,
                  unreadCount: byChat?.[chat.id] || 0,
                }),
              ),
            ]),
          ),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void loadChats().finally(() => setLoading(false));
    void loadPendingCount();
  }, [loadChats, loadPendingCount]);

  useEffect(() => {
    connectChatSocket();
    return () => disconnectChatSocket();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(refreshUnreadBadges, 30_000);
    window.addEventListener('focus', refreshUnreadBadges);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshUnreadBadges);
    };
  }, [refreshUnreadBadges]);

  /** Load history for a chat from PostgreSQL. Never wipes other chats. */
  const loadHistory = useCallback(async (chatId) => {
    if (!chatId) return;
    setHistoryStatusByChat((prev) => ({ ...prev, [chatId]: 'loading' }));
    setHistoryErrorByChat((prev) => ({ ...prev, [chatId]: null }));
    try {
      const listedMessages = await chatsApi.messages(chatId, { limit: PAGE_SIZE });
      const chronological = toChronological(listedMessages);
      setMessagesByChat((prev) => ({ ...prev, [chatId]: chronological }));
      setHasMoreByChat((prev) => ({
        ...prev,
        [chatId]: Array.isArray(listedMessages) && listedMessages.length >= PAGE_SIZE,
      }));
      setHistoryStatusByChat((prev) => ({ ...prev, [chatId]: 'ready' }));
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
  }, []);

  useEffect(() => {
    if (!activeChatId) {
      setMembers([]);
      setPins([]);
      setTypingUserIds([]);
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
          if (next.chatId === activeChatIdRef.current) {
            setHistoryStatusByChat((prev) => ({ ...prev, [next.chatId]: 'ready' }));
            setGroups((prev) => patchUnread(prev, next.chatId, 0));
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
        'message.updated': (message) => {
          const next = normalizeMessage(message);
          if (!next?.chatId) return;
          setMessagesByChat((prev) => ({
            ...prev,
            [next.chatId]: upsertMessage(prev[next.chatId], next),
          }));
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
          if (chatId === activeChatIdRef.current && userId && userId !== user?.id) {
            setTypingUserIds((previous) => [...new Set([...previous, userId])]);
          }
        },
        'typing.stop': (payload) => {
          const chatId = pickField(payload, 'chatId', 'chat_id');
          const userId = pickField(payload, 'userId', 'user_id');
          if (chatId === activeChatIdRef.current && userId) {
            setTypingUserIds((previous) => previous.filter((id) => id !== userId));
          }
        },
        'user.online': (payload) => {
          const userId = pickField(payload, 'userId', 'user_id');
          if (userId) setOnlineUserIds((previous) => [...new Set([...previous, userId])]);
        },
        'user.offline': (payload) => {
          const userId = pickField(payload, 'userId', 'user_id');
          if (userId) setOnlineUserIds((previous) => previous.filter((id) => id !== userId));
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
      }),
    [loadChats, loadPendingCount, user?.id],
  );

  const selectChat = (chat) => {
    setActiveChat(normalizeChat(chat));
    setMobilePane('chat');
    setRequestsOpen(false);
    setInfoOpen(false);
    setTypingUserIds([]);
  };

  const backToChatList = () => {
    setMobilePane('list');
    setInfoOpen(false);
    if (!isLgUp) setActiveChat(null);
  };

  const onMarkRead = useCallback(
    (messageId) => {
      const chatId = activeChatIdRef.current;
      if (!chatId || !messageId) return;
      void chatsApi
        .markRead(chatId, messageId)
        .then(() => {
          emitMessageRead(chatId, messageId);
          setGroups((prev) => patchUnread(prev, chatId, 0));
        })
        .catch(() => {});
    },
    [],
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

  const openRequests = () => {
    setRequestsOpen(true);
    setSearchParams({ tab: 'requests' });
  };

  const closeRequests = () => {
    setRequestsOpen(false);
    setSearchParams({});
  };

  const content = useMemo(
    () => (
      <ChatSidebar
        groups={groups}
        activeChatId={activeChatId}
        onSelect={selectChat}
        onFindInterlocutor={() => setFinderOpen(true)}
        onOpenRequests={openRequests}
        onlineUserIds={onlineUserIds}
        pendingRequestsCount={pendingRequestsCount}
      />
    ),
    [groups, activeChatId, onlineUserIds, pendingRequestsCount],
  );

  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-[28rem] overflow-hidden bg-background lg:h-app">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)_18rem]">
        {/* Desktop list */}
        <aside className="hidden min-h-0 border-r border-border lg:block">{content}</aside>

        {/* Mobile list pane */}
        <section
          className={`min-h-0 flex-col ${
            isLgUp || mobilePane === 'list' ? 'flex' : 'hidden'
          } lg:hidden`}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Загрузка чатов…
            </div>
          ) : (
            content
          )}
        </section>

        {/* Conversation pane (desktop always; mobile when chat selected) */}
        <section
          className={`min-h-0 flex-col ${
            isLgUp || mobilePane === 'chat' ? 'flex' : 'hidden'
          }`}
        >
          {loading && isLgUp ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Загрузка чатов…
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1">
                <ChatMessagePane
                  chat={activeChat}
                  messages={messages}
                  typingUserIds={typingUserIds}
                  currentUserId={user?.id}
                  historyStatus={historyStatus}
                  historyError={historyError}
                  loadingOlder={loadingOlder}
                  hasMoreOlder={hasMoreOlder}
                  onLoadOlder={() => void loadOlderMessages()}
                  onBack={backToChatList}
                  onOpenInfo={() => setInfoOpen(true)}
                  onPin={(messageId) => void pin(messageId)}
                  onMarkRead={onMarkRead}
                  onNeedUnlock={() => setE2eeUnlockOpen(true)}
                />
              </div>
              {activeChat ? (
                <div className="shrink-0 safe-pb border-t border-border">
                  <ChatComposer
                    chat={activeChat}
                    disabled={activeChat.kind === 'school_news' && user?.role !== 'admin'}
                    onMessageCreated={addMessage}
                    onAttachmentUploaded={onAttachmentUploaded}
                    onNeedUnlock={() => setE2eeUnlockOpen(true)}
                  />
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside className="hidden min-h-0 border-l border-border lg:block">
          {requestsOpen ? (
            <DmRequestsPanel
              open
              onClose={closeRequests}
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
              onUnpin={(messageId) => void unpin(messageId)}
              onHide={() => void hideChat()}
            />
          )}
        </aside>
      </div>

      <Sheet open={infoOpen && !isLgUp} onOpenChange={setInfoOpen}>
        <SheetContent side="bottom" className="h-[min(88dvh,100%)] max-h-[88dvh] rounded-t-2xl p-0 safe-pb">
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
              onUnpin={(messageId) => void unpin(messageId)}
              onHide={() => void hideChat()}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Mobile requests from sidebar CTA */}
      <Sheet
        open={requestsOpen && !isLgUp && mobilePane === 'list'}
        onOpenChange={(open) => {
          if (!open) closeRequests();
          else setRequestsOpen(true);
        }}
      >
        <SheetContent side="bottom" className="h-[min(88dvh,100%)] rounded-t-2xl p-0 safe-pb">
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
    </div>
  );
}
