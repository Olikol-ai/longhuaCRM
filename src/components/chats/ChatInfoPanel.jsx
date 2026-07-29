import { Pin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { displayUserName, pickField } from '@/lib/chat-normalize';

function memberName(member) {
  const user = pickField(member, 'user') || {};
  return displayUserName(user);
}

export default function ChatInfoPanel({ chat, members = [], pins = [], onUnpin, onHide }) {
  if (!chat) return <div className="p-4 text-sm text-muted-foreground">Выберите чат.</div>;
  const memberCount = pickField(chat, 'memberCount', 'member_count');
  const onlineCount = pickField(chat, 'onlineCount', 'online_count');
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="border-b border-border p-4 space-y-2">
        <h2 className="text-sm font-semibold">{chat.title || 'Чат'}</h2>
        {chat.description ? <p className="mt-1 text-xs text-muted-foreground">{chat.description}</p> : null}
        {(memberCount != null || onlineCount != null) && (
          <p className="text-xs text-muted-foreground">
            👥 {memberCount ?? members.length} · Онлайн: {onlineCount ?? 0}
          </p>
        )}
        {onHide ? (
          <Button variant="outline" size="sm" className="w-full" onClick={onHide}>
            Удалить у себя
          </Button>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1 p-4">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-4 w-4" /> Участники · {members.length}
          </h3>
          <div className="space-y-2">
            {members.map((member) => (
              <p key={member.id} className="text-sm">
                {memberName(member)}
              </p>
            ))}
          </div>
        </section>
        <section className="mt-6">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Pin className="h-4 w-4" /> Закреплённые
          </h3>
          <div className="space-y-2">
            {pins.length ? (
              pins.map((pin) => {
                const messageId = pickField(pin, 'messageId', 'message_id');
                const body = pickField(pin.message, 'body');
                return (
                  <div key={pin.id || messageId} className="rounded-md border border-border p-2">
                    <p className="line-clamp-3 text-sm">{body || 'Вложение или CRM-карточка'}</p>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto px-0"
                      onClick={() => onUnpin(messageId)}
                    >
                      Открепить
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground">Нет закреплённых сообщений</p>
            )}
          </div>
        </section>
      </ScrollArea>
    </div>
  );
}
