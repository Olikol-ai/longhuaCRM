import { Hash, Inbox, MessageCircle, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePresence } from '@/lib/PresenceContext';
import { cn } from '@/lib/utils';

const sections = [
  { title: 'Системные', kinds: ['subject', 'school_news', 'school_community'], icon: Hash },
  { title: 'Курсы', kinds: ['course'], icon: Hash },
  { title: 'Группы', kinds: ['group'], icon: Users },
  { title: 'Личные', kinds: ['direct'], icon: MessageCircle },
];

function ChatRow({ chat, active, onSelect, currentUserId }) {
  const { isUserOnline, countOnlineAmong } = usePresence();
  const memberCount = chat.memberCount ?? chat.member_count;
  const memberUserIds = chat.memberUserIds || chat.member_user_ids || [];
  const onlineCount =
    memberUserIds.length > 0
      ? countOnlineAmong(memberUserIds)
      : (chat.onlineCount ?? chat.online_count ?? 0);
  const unreadCount = chat.unreadCount ?? chat.unread_count ?? 0;

  const peerId =
    chat.kind === 'direct'
      ? memberUserIds.find((id) => id && id !== currentUserId) || null
      : null;
  const peerOnline = peerId ? isUserOnline(peerId) : false;

  const memberMeta =
    chat.kind !== 'direct' && (memberCount != null || onlineCount != null)
      ? `👥 ${memberCount ?? '—'} · Онлайн: ${onlineCount ?? 0}`
      : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(chat)}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-brand-soft text-brand' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <span className="relative shrink-0">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {(chat.title || '?').slice(0, 1).toUpperCase()}
        </span>
        {chat.kind === 'direct' && peerOnline ? (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{chat.title || 'Личный чат'}</span>
        {memberMeta ? (
          <span className="block truncate text-[11px] opacity-75">{memberMeta}</span>
        ) : chat.kind === 'direct' ? (
          <span className="block truncate text-[11px] opacity-75">Зашифрованное сообщение</span>
        ) : chat.description ? (
          <span className="block truncate text-[11px] opacity-75">{chat.description}</span>
        ) : null}
      </span>
      {unreadCount > 0 ? (
        <span className="flex min-w-4 h-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </button>
  );
}

export default function ChatSidebar({
  groups = {},
  activeChatId,
  onSelect,
  onFindInterlocutor,
  onOpenRequests,
  currentUserId,
  pendingRequestsCount = 0,
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <div>
          <h1 className="text-base font-semibold">Чаты</h1>
          <p className="text-xs text-muted-foreground">Общение по учёбе</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onFindInterlocutor} aria-label="Новый чат">
          <Search />
        </Button>
      </div>
      <div className="space-y-2 px-3 pt-2">
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={onFindInterlocutor}>
          <Search /> Новый чат
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onOpenRequests}>
          <Inbox /> Запросы
          {pendingRequestsCount > 0 ? (
            <span className="ml-auto rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
              {pendingRequestsCount}
            </span>
          ) : null}
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2 py-3">
        <div className="space-y-4">
          {sections.map(({ title, kinds, icon: Icon }) => {
            const chats = kinds.flatMap((kind) => groups[kind] || []);
            return (
              <section key={title}>
                <div className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" /> {title}
                </div>
                <div className="space-y-0.5">
                  {chats.length ? (
                    chats.map((chat) => (
                      <ChatRow
                        key={chat.id}
                        chat={chat}
                        active={chat.id === activeChatId}
                        onSelect={onSelect}
                        currentUserId={currentUserId}
                      />
                    ))
                  ) : (
                    <p className="px-2 py-1 text-xs text-muted-foreground">Нет чатов</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
