import { Hash, MessageCircle, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const sections = [
  { title: 'Системные', kinds: ['subject', 'school_news', 'school_community'], icon: Hash },
  { title: 'Курсы', kinds: ['course'], icon: Hash },
  { title: 'Группы', kinds: ['group'], icon: Users },
  { title: 'Личные', kinds: ['direct'], icon: MessageCircle },
];

function ChatRow({ chat, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(chat)}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-brand-soft text-brand' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{chat.title}</span>
        {chat.description ? <span className="block truncate text-[11px] opacity-75">{chat.description}</span> : null}
      </span>
      {chat.unreadCount > 0 ? (
        <span className="flex min-w-4 h-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
        </span>
      ) : null}
    </button>
  );
}

export default function ChatSidebar({ groups = {}, activeChatId, onSelect, onFindInterlocutor }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <div>
          <h1 className="text-base font-semibold">Чаты</h1>
          <p className="text-xs text-muted-foreground">Общение по учёбе</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onFindInterlocutor} aria-label="Найти собеседника">
          <Search />
        </Button>
      </div>
      <div className="px-3 pt-2">
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={onFindInterlocutor}>
          <Search /> Найти собеседника
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
                  {chats.length ? chats.map((chat) => (
                    <ChatRow key={chat.id} chat={chat} active={chat.id === activeChatId} onSelect={onSelect} />
                  )) : <p className="px-2 py-1 text-xs text-muted-foreground">Нет чатов</p>}
                </div>
              </section>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
