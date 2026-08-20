import { Archive, BookOpen, ClipboardCheck, Info, Pin, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, IconButton, StatusPill } from '@/design-system';
import { iconSize } from '@/design-system/tokens/icon';
import { chatAttachmentDownloadSrc } from '@/lib/chat-attachment-url';
import { displayUserName, pickField } from '@/lib/chat-normalize';
import { attachmentName, fileKindLabel } from '@/lib/chat/file-kind';
import { resolveChatPeerUser, resolveChatTitle } from '@/lib/chat/titles';
import { formatChatPresence, formatGroupPresence, roleLabel } from '@/lib/chat/presence-line';
import { usePresence } from '@/lib/PresenceContext';
import ChatAvatar from './ChatAvatar';

const TABS = [
  { id: 'info', label: 'Информация', icon: Info },
  { id: 'members', label: 'Участники', icon: Users },
  { id: 'files', label: 'Файлы', icon: Archive },
  { id: 'materials', label: 'Материалы', icon: BookOpen },
  { id: 'homework', label: 'Задания', icon: ClipboardCheck },
  { id: 'pins', label: 'Закрепления', icon: Pin },
];

function memberName(member) {
  const user = pickField(member, 'user') || {};
  return displayUserName(user);
}

export default function ChatInfoPanel({
  chat,
  members = [],
  pins = [],
  messages = [],
  currentUserId,
  onClose,
  onUnpin,
  onHide,
  onJumpMessage,
}) {
  const { isUserOnline, countOnlineAmong } = usePresence();
  const [tab, setTab] = useState('info');

  useEffect(() => {
    setTab('info');
  }, [chat?.id]);

  const files = useMemo(
    () =>
      (messages || []).flatMap((message) =>
        (message.attachments || []).map((attachment) => ({
          ...attachment,
          messageId: message.id,
        })),
      ),
    [messages],
  );
  const materials = useMemo(
    () => (messages || []).filter((message) => message.type === 'material' || message.type === 'exam'),
    [messages],
  );
  const homework = useMemo(
    () => (messages || []).filter((message) => message.type === 'homework' || message.type === 'lesson'),
    [messages],
  );

  if (!chat) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-card/95">
        {onClose ? (
          <div className="flex justify-end px-2 pt-2">
            <IconButton label="Закрыть" onClick={onClose}>
              <X />
            </IconButton>
          </div>
        ) : null}
        <EmptyState
          preset="messages"
          title="Выберите чат"
          description="Справа появится информация, файлы и участники."
        />
      </div>
    );
  }

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
  const title = resolveChatTitle(chat, { currentUserId, members });
  const peerUser = resolveChatPeerUser(chat, { currentUserId, members }) || peer;

  return (
    <div className="flex h-full min-h-0 flex-col bg-card/95">
      <div className="flex min-w-0 items-start gap-1 border-b border-border/60 px-2 py-2">
        <div
          className="lh-chat-info-tabs"
          role="tablist"
          aria-label="Информация о чате"
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                type="button"
                size="sm"
                intent={tab === item.id ? 'primary' : 'ghost'}
                className="lh-chat-info-tabs__btn"
                onClick={() => setTab(item.id)}
                aria-label={item.label}
                aria-selected={tab === item.id}
                role="tab"
                title={item.label}
              >
                <Icon className={iconSize.sm} aria-hidden />
                <span>{item.label}</span>
              </Button>
            );
          })}
        </div>
        {onClose ? (
          <IconButton label="Закрыть" className="mt-0.5 shrink-0" onClick={onClose}>
            <X />
          </IconButton>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
        {tab === 'info' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ChatAvatar title={title} kind={chat.kind} user={peerUser} size="lg" online={peerOnline} />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">{title}</h2>
                <p className="text-xs text-muted-foreground">
                  {isDirect
                    ? formatChatPresence(peerLastSeen, peerOnline)
                    : formatGroupPresence(memberCount, onlineCount)}
                </p>
              </div>
            </div>
            {chat.kind === 'subject' ? (
              <p className="text-xs text-muted-foreground">
                Предметный чат
                {pickField(chat, 'subject')?.name ? ` · ${pickField(chat, 'subject').name}` : ''}
              </p>
            ) : null}
            {chat.description ? <p className="text-sm text-muted-foreground">{chat.description}</p> : null}
            {onHide ? (
              <Button intent="outline" size="sm" className="w-full" onClick={onHide}>
                Удалить у себя
              </Button>
            ) : null}
          </div>
        ) : null}

        {tab === 'members' ? (
          <div className="space-y-2">
            {members.map((member) => {
              const user = pickField(member, 'user') || {};
              const userId = user.id || pickField(member, 'userId', 'user_id');
              const online = userId ? isUserOnline(userId) : false;
              return (
                <div key={member.id || userId} className="flex items-center gap-3 rounded-xl px-1 py-2">
                  <ChatAvatar user={user} online={online} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{memberName(member)}</p>
                    <p className="text-[11px] text-muted-foreground">{roleLabel(user.role)}</p>
                  </div>
                  <StatusPill status={online ? 'online' : 'offline'}>
                    {online ? 'На платформе' : 'Не в сети'}
                  </StatusPill>
                </div>
              );
            })}
          </div>
        ) : null}

        {tab === 'files' ? (
          files.length ? (
            <div className="space-y-2">
              {files.map((attachment) => (
                <a
                  key={attachment.id}
                  href={chatAttachmentDownloadSrc(attachment.id)}
                  className="flex min-h-touch items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                  download={attachmentName(attachment)}
                >
                  <span className="truncate">{attachmentName(attachment)}</span>
                  <span className="text-[11px] text-muted-foreground">{fileKindLabel(attachment)}</span>
                </a>
              ))}
            </div>
          ) : (
            <EmptyState preset="generic" title="Нет файлов" description="Вложения из переписки появятся здесь." />
          )
        ) : null}

        {tab === 'materials' ? (
          materials.length ? (
            <div className="space-y-2">
              {materials.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => onJumpMessage?.(message.id)}
                >
                  {message.body || 'Материал курса'}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState preset="materials" />
          )
        ) : null}

        {tab === 'homework' ? (
          homework.length ? (
            <div className="space-y-2">
              {homework.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => onJumpMessage?.(message.id)}
                >
                  {message.body || (message.type === 'lesson' ? 'Урок' : 'Домашнее задание')}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState preset="homework" />
          )
        ) : null}

        {tab === 'pins' ? (
          pins.length ? (
            <div className="space-y-2">
              {pins.map((pin) => {
                const messageId = pickField(pin, 'messageId', 'message_id');
                const body = pickField(pin.message, 'body');
                const ciphertext = pickField(pin.message, 'ciphertext');
                const preview =
                  body || (ciphertext ? 'Зашифрованное сообщение' : null) || 'Вложение или карточка';
                return (
                  <div key={pin.id || messageId} className="rounded-xl border border-border p-3">
                    <button
                      type="button"
                      className="line-clamp-3 w-full text-left text-sm"
                      onClick={() => onJumpMessage?.(messageId)}
                    >
                      {preview}
                    </button>
                    <Button intent="link" size="sm" className="mt-1 h-auto px-0" onClick={() => onUnpin(messageId)}>
                      Открепить
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState preset="generic" title="Нет закреплённых" description="Закрепите важное сообщение из переписки." />
          )
        ) : null}
      </div>
    </div>
  );
}
