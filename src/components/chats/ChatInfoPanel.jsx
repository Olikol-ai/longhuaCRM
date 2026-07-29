import { Pin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

function memberName(member) {
  const user = member.user || {};
  return [user.lastName, user.firstName].filter(Boolean).join(' ') || user.email || 'Пользователь';
}

export default function ChatInfoPanel({ chat, members = [], pins = [], onUnpin }) {
  if (!chat) return <div className="p-4 text-sm text-muted-foreground">Выберите чат.</div>;
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-semibold">{chat.title}</h2>
        {chat.description ? <p className="mt-1 text-xs text-muted-foreground">{chat.description}</p> : null}
      </div>
      <ScrollArea className="min-h-0 flex-1 p-4">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Users className="h-4 w-4" /> Участники · {members.length}</h3>
          <div className="space-y-2">
            {members.map((member) => <p key={member.id} className="text-sm">{memberName(member)}</p>)}
          </div>
        </section>
        <section className="mt-6">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Pin className="h-4 w-4" /> Закреплённые</h3>
          <div className="space-y-2">
            {pins.length ? pins.map((pin) => (
              <div key={pin.id || pin.messageId} className="rounded-md border border-border p-2">
                <p className="line-clamp-3 text-sm">{pin.message?.body || 'Вложение или CRM-карточка'}</p>
                <Button variant="link" size="sm" className="mt-1 h-auto px-0" onClick={() => onUnpin(pin.messageId)}>Открепить</Button>
              </div>
            )) : <p className="text-xs text-muted-foreground">Нет закреплённых сообщений</p>}
          </div>
        </section>
      </ScrollArea>
    </div>
  );
}
