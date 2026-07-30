import { Pin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { displayUserName, pickField } from '@/lib/chat-normalize';
import { usePresence } from '@/lib/PresenceContext';
import { formatDirectPresence } from '@/lib/presence-format';

function memberName(member) {
  const user = pickField(member, 'user') || {};
  return displayUserName(user);
}

export default function ChatInfoPanel({
  chat,
  members = [],
  pins = [],
  currentUserId,
  onUnpin,
  onHide,
}) {
  const { isUserOnline, countOnlineAmong } = usePresence();

  if (!chat) return <div className="p-4 text-sm text-muted-foreground">Выберите чат.</div>;

  const memberCount = pickField(chat, 'memberCount', 'member_count') ?? members.length;
  const memberUserIds =
    (chat.memberUserIds || chat.member_user_ids || []).length
      ? chat.memberUserIds || chat.member_user_ids
      : members
          .map((m) => pickField(m, 'userId', 'user_id') || pickField(m, 'user')?.id)
          .filter(Boolean);
  const onlineCount = countOnlineAmong(memberUserIds);
  const isDirect = chat.kind === 'direct';

  const peer = isDirect
    ? members
        .map((m) => pickField(m, 'user') || {})
        .find((u) => u?.id && u.id !== currentUserId)
    : null;
  const peerOnline = peer?.id ? isUserOnline(peer.id) : false;
  const peerLastSeen = pickField(peer, 'lastSeenAt', 'last_seen_at');
  const directStatus = isDirect ? formatDirectPresence(peerLastSeen, peerOnline) : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="border-b border-border p-4 space-y-2">
        <h2 className="text-sm font-semibold">{chat.title || 'Чат'}</h2>
        {isDirect ? (
          <p className="text-xs text-muted-foreground">{directStatus}</p>
        ) : (
          <>
            {chat.description ? (
              <p className="mt-1 text-xs text-muted-foreground">{chat.description}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Участников: {memberCount ?? members.length} · Онлайн: {onlineCount}
            </p>
          </>
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
            {members.map((member) => {
              const user = pickField(member, 'user') || {};
              const userId = user.id || pickField(member, 'userId', 'user_id');
              const online = userId ? isUserOnline(userId) : false;
              return (
                <p key={member.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                    aria-hidden
                  />
                  {memberName(member)}
                </p>
              );
            })}
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
                const ciphertext = pickField(pin.message, 'ciphertext');
                const preview = body
                  || (ciphertext ? 'Зашифрованное сообщение' : null)
                  || 'Вложение или CRM-карточка';
                return (
                  <div key={pin.id || messageId} className="rounded-md border border-border p-2">
                    <p className="line-clamp-3 text-sm">{preview}</p>
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
