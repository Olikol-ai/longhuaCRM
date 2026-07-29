import { Menu, PanelRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { chatsApi } from '@/api/chats.api';
import ChatComposer from '@/components/chats/ChatComposer';
import ChatInfoPanel from '@/components/chats/ChatInfoPanel';
import ChatMessagePane from '@/components/chats/ChatMessagePane';
import ChatSidebar from '@/components/chats/ChatSidebar';
import DmRequestsPanel from '@/components/chats/DmRequestsPanel';
import FindInterlocutorDialog from '@/components/chats/FindInterlocutorDialog';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
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

function addOrReplaceMessage(previous, message) {
  const next = normalizeMessage(message);
  if (!next?.id) return previous;
  const existing = previous.findIndex((item) => item.id === next.id);
  if (existing === -1) {
    return [...previous, next].sort((a, b) => messageCreatedAtMs(a) - messageCreatedAtMs(b));
  }
  return previous.map((item) => (item.id === next.id ? { ...item, ...next } : item));
}

function toChronological(listedNewestFirst) {
  return [...normalizeMessages(listedNewestFirst)].reverse();
}

export default function Chats() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState(emptyGroups);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [pins, setPins] = useState([]);
  const [typingUserIds, setTypingUserIds] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(searchParams.get('tab') === 'requests');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);

  const loadChats = useCallback(async (preferredChatId) => {
    const data = await chatsApi.list();
    const nextGroups = normalizeChatGroups(data.groups || {});
    setGroups(nextGroups);
    setActiveChat((current) => {
      const allChats = Object.values(nextGroups).flat();
      return (
        allChats.find((chat) => chat.id === (preferredChatId || current?.id)) ||
        allChats[0] ||
        null
      );
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

  useEffect(() => {
    void loadChats().finally(() => setLoading(false));
    void loadPendingCount();
  }, [loadChats, loadPendingCount]);

  useEffect(() => {
    connectChatSocket();
    return () => disconnectChatSocket();
  }, []);

  useEffect(() => {
    const refreshUnread = () =>
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
    const interval = window.setInterval(refreshUnread, 30_000);
    window.addEventListener('focus', refreshUnread);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshUnread);
    };
  }, []);

  useEffect(() => {
    if (!activeChat?.id) {
      setMessages([]);
      setMembers([]);
      setPins([]);
      setHasMoreOlder(true);
      return undefined;
    }
    let stale = false;
    const chatId = activeChat.id;
    joinChat(chatId);
    setHasMoreOlder(true);
    Promise.all([
      chatsApi.messages(chatId, { limit: PAGE_SIZE }),
      chatsApi.members(chatId),
      chatsApi.pins(chatId),
    ])
      .then(([listedMessages, chatMembers, chatPins]) => {
        if (stale) return;
        const chronological = toChronological(listedMessages);
        setMessages(chronological);
        setHasMoreOlder(Array.isArray(listedMessages) && listedMessages.length >= PAGE_SIZE);
        setMembers(Array.isArray(chatMembers) ? chatMembers : []);
        setPins(Array.isArray(chatPins) ? chatPins : []);
      })
      .catch((err) => {
        if (stale) return;
        setMessages([]);
        toast({
          title: 'Не удалось загрузить историю',
          description: err?.message,
          variant: 'destructive',
        });
      });
    return () => {
      stale = true;
      leaveChat(chatId);
    };
  }, [activeChat?.id]);

  useEffect(
    () =>
      subscribeToChatSocket({
        'message.created': (message) => {
          const next = normalizeMessage(message);
          if (!next) return;
          if (next.chatId !== activeChat?.id) {
            void loadChats();
            return;
          }
          setMessages((previous) => addOrReplaceMessage(previous, next));
          void loadChats(activeChat.id);
        },
        'message.updated': (message) => {
          const next = normalizeMessage(message);
          if (next?.chatId === activeChat?.id) {
            setMessages((previous) => addOrReplaceMessage(previous, next));
          }
        },
        'message.deleted': (payload) => {
          const chatId = pickField(payload, 'chatId', 'chat_id');
          const messageId = pickField(payload, 'messageId', 'message_id');
          if (chatId === activeChat?.id && messageId) {
            setMessages((previous) => previous.filter((message) => message.id !== messageId));
          }
        },
        'typing.start': (payload) => {
          const chatId = pickField(payload, 'chatId', 'chat_id');
          const userId = pickField(payload, 'userId', 'user_id');
          if (chatId === activeChat?.id && userId && userId !== user?.id) {
            setTypingUserIds((previous) => [...new Set([...previous, userId])]);
          }
        },
        'typing.stop': (payload) => {
          const chatId = pickField(payload, 'chatId', 'chat_id');
          const userId = pickField(payload, 'userId', 'user_id');
          if (chatId === activeChat?.id && userId) {
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
          if (activeChat?.id === chatId) setActiveChat(null);
          void loadChats();
        },
      }),
    [activeChat?.id, loadChats, loadPendingCount, user?.id],
  );

  const selectChat = (chat) => {
    setActiveChat(normalizeChat(chat));
    setSidebarOpen(false);
    setRequestsOpen(false);
  };

  const onMarkRead = useCallback(
    (messageId) => {
      if (!activeChat?.id || !messageId) return;
      void chatsApi
        .markRead(activeChat.id, messageId)
        .then(() => emitMessageRead(activeChat.id, messageId))
        .catch(() => {});
    },
    [activeChat?.id],
  );

  const loadOlderMessages = useCallback(async () => {
    if (!activeChat?.id || loadingOlder || !hasMoreOlder || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest?.id) return;
    setLoadingOlder(true);
    try {
      const listed = await chatsApi.messages(activeChat.id, {
        limit: PAGE_SIZE,
        before: oldest.id,
      });
      const older = toChronological(listed);
      setHasMoreOlder(Array.isArray(listed) && listed.length >= PAGE_SIZE);
      if (older.length) {
        setMessages((previous) => {
          const ids = new Set(previous.map((item) => item.id));
          const merged = [...older.filter((item) => !ids.has(item.id)), ...previous];
          return merged.sort((a, b) => messageCreatedAtMs(a) - messageCreatedAtMs(b));
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
  }, [activeChat?.id, hasMoreOlder, loadingOlder, messages]);

  const addMessage = (message) => {
    setMessages((previous) => addOrReplaceMessage(previous, message));
    void loadChats(activeChat?.id);
  };

  const uploadedAttachment = () => {
    if (!activeChat?.id) return;
    void chatsApi
      .messages(activeChat.id, { limit: PAGE_SIZE })
      .then((listed) => {
        setMessages(toChronological(listed));
        setHasMoreOlder(Array.isArray(listed) && listed.length >= PAGE_SIZE);
      })
      .catch((err) => {
        toast({
          title: 'Не удалось обновить историю',
          description: err?.message,
          variant: 'destructive',
        });
      });
  };

  const pin = async (messageId) => {
    if (!activeChat?.id) return;
    await chatsApi.pin(activeChat.id, messageId);
    setPins(await chatsApi.pins(activeChat.id));
  };

  const unpin = async (messageId) => {
    if (!activeChat?.id) return;
    await chatsApi.unpin(activeChat.id, messageId);
    setPins((previous) =>
      previous.filter(
        (pinItem) => pickField(pinItem, 'messageId', 'message_id') !== messageId,
      ),
    );
  };

  const hideChat = async () => {
    if (!activeChat?.id) return;
    try {
      await chatsApi.hideMembership(activeChat.id);
      toast({ title: 'Чат скрыт у вас' });
      setActiveChat(null);
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
        activeChatId={activeChat?.id}
        onSelect={selectChat}
        onFindInterlocutor={() => setFinderOpen(true)}
        onOpenRequests={openRequests}
        onlineUserIds={onlineUserIds}
        pendingRequestsCount={pendingRequestsCount}
      />
    ),
    [groups, activeChat?.id, onlineUserIds, pendingRequestsCount],
  );

  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-[32rem] overflow-hidden bg-background lg:h-app">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)_18rem]">
        <aside className="hidden min-h-0 border-r border-border lg:block">{content}</aside>
        <section className="flex min-h-0 flex-col">
          <div className="flex h-0 justify-between px-2 pt-2 lg:hidden">
            <Button
              size="icon"
              variant="ghost"
              className="z-10"
              onClick={() => setSidebarOpen(true)}
              aria-label="Открыть список чатов"
            >
              <Menu />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="z-10"
              onClick={() => setInfoOpen(true)}
              aria-label="Открыть информацию"
            >
              <PanelRight />
            </Button>
          </div>
          {loading ? (
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
                  loadingOlder={loadingOlder}
                  hasMoreOlder={hasMoreOlder}
                  onLoadOlder={() => void loadOlderMessages()}
                  onOpenSidebar={() => setSidebarOpen(true)}
                  onOpenInfo={() => setInfoOpen(true)}
                  onPin={(messageId) => void pin(messageId)}
                  onMarkRead={onMarkRead}
                />
              </div>
              {activeChat ? (
                <ChatComposer
                  chat={activeChat}
                  disabled={activeChat.kind === 'school_news' && user?.role !== 'admin'}
                  onMessageCreated={addMessage}
                  onAttachmentUploaded={uploadedAttachment}
                />
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
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
          {content}
        </SheetContent>
      </Sheet>
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="right" className="w-[85vw] max-w-sm p-0">
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
      <FindInterlocutorDialog
        open={finderOpen}
        onOpenChange={setFinderOpen}
        onRequestSent={() => {
          void loadPendingCount();
          openRequests();
        }}
      />
    </div>
  );
}
