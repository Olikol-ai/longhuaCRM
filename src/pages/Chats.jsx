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
  connectChatSocket,
  disconnectChatSocket,
  emitMessageRead,
  joinChat,
  leaveChat,
  subscribeToChatSocket,
} from '@/lib/chat-socket';

const emptyGroups = {};

function addOrReplaceMessage(previous, message) {
  const existing = previous.findIndex((item) => item.id === message.id);
  if (existing === -1) {
    return [...previous, message].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    );
  }
  return previous.map((item) => (item.id === message.id ? { ...item, ...message } : item));
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

  const loadChats = useCallback(async (preferredChatId) => {
    const data = await chatsApi.list();
    setGroups(data.groups || {});
    setActiveChat((current) => {
      const allChats = Object.values(data.groups || {}).flat();
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
        .then(({ byChat }) =>
          setGroups((previous) =>
            Object.fromEntries(
              Object.entries(previous).map(([kind, chats]) => [
                kind,
                chats.map((chat) => ({
                  ...chat,
                  unreadCount: byChat?.[chat.id] || 0,
                })),
              ]),
            ),
          ),
        )
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
      return undefined;
    }
    let stale = false;
    const chatId = activeChat.id;
    joinChat(chatId);
    Promise.all([
      chatsApi.messages(chatId, { limit: 100 }),
      chatsApi.members(chatId),
      chatsApi.pins(chatId),
    ])
      .then(([listedMessages, chatMembers, chatPins]) => {
        if (stale) return;
        setMessages([...listedMessages].reverse());
        setMembers(chatMembers);
        setPins(chatPins);
      })
      .catch(() => {
        if (!stale) setMessages([]);
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
          if (message.chatId !== activeChat?.id) {
            void loadChats();
            return;
          }
          setMessages((previous) => addOrReplaceMessage(previous, message));
          void loadChats(activeChat.id);
        },
        'message.updated': (message) => {
          if (message.chatId === activeChat?.id) {
            setMessages((previous) => addOrReplaceMessage(previous, message));
          }
        },
        'message.deleted': ({ chatId, messageId }) => {
          if (chatId === activeChat?.id) {
            setMessages((previous) => previous.filter((message) => message.id !== messageId));
          }
        },
        'typing.start': ({ chatId, userId }) => {
          if (chatId === activeChat?.id && userId !== user?.id) {
            setTypingUserIds((previous) => [...new Set([...previous, userId])]);
          }
        },
        'typing.stop': ({ chatId, userId }) => {
          if (chatId === activeChat?.id) {
            setTypingUserIds((previous) => previous.filter((id) => id !== userId));
          }
        },
        'user.online': ({ userId }) => {
          setOnlineUserIds((previous) => [...new Set([...previous, userId])]);
        },
        'user.offline': ({ userId }) => {
          setOnlineUserIds((previous) => previous.filter((id) => id !== userId));
        },
        'chat.request.created': () => {
          void loadPendingCount();
        },
        'chat.request.accepted': (payload) => {
          void loadPendingCount();
          void loadChats(payload?.chat?.id || payload?.createdChatId);
        },
        'chat.created': (chat) => {
          void loadChats(chat?.id);
        },
        'chat.deleted': ({ chatId }) => {
          if (activeChat?.id === chatId) setActiveChat(null);
          void loadChats();
        },
      }),
    [activeChat?.id, loadChats, loadPendingCount, user?.id],
  );

  const selectChat = (chat) => {
    setActiveChat(chat);
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

  const addMessage = (message) => {
    setMessages((previous) => addOrReplaceMessage(previous, message));
    void loadChats(activeChat?.id);
  };

  const uploadedAttachment = () => {
    if (!activeChat?.id) return;
    void chatsApi
      .messages(activeChat.id, { limit: 100 })
      .then((listed) => setMessages([...listed].reverse()));
  };

  const pin = async (messageId) => {
    if (!activeChat?.id) return;
    await chatsApi.pin(activeChat.id, messageId);
    setPins(await chatsApi.pins(activeChat.id));
  };

  const unpin = async (messageId) => {
    if (!activeChat?.id) return;
    await chatsApi.unpin(activeChat.id, messageId);
    setPins((previous) => previous.filter((pinItem) => pinItem.messageId !== messageId));
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
                const chatId = accepted?.createdChatId || accepted?.created_chat_id;
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
                const chatId = accepted?.createdChatId || accepted?.created_chat_id;
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
