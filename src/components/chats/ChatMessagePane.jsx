import { ArrowLeft, Info, Pin, Users } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { chatAttachmentSrc } from '@/lib/chat-attachment-url';
import { displayUserName } from '@/lib/chat-normalize';
import CrmMessageCard from './CrmMessageCard';
import VoicePlayer from './VoicePlayer';

const CRM_TYPES = new Set(['lesson', 'homework', 'exam', 'material']);

function senderName(message) {
  const sender = message.senderUser;
  if (!sender) return message.type === 'ai_response' ? 'Longhua AI' : 'Система';
  return displayUserName(sender);
}

function Attachment({ attachment }) {
  const src = chatAttachmentSrc(attachment.id);
  if (attachment.kind === 'voice') return <VoicePlayer attachment={attachment} />;
  if (!src) {
    return <span className="mt-1 block text-xs text-muted-foreground">Вложение недоступно</span>;
  }
  if (attachment.kind === 'image') {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="block max-w-full">
        <img
          className="mt-1 max-h-64 max-w-full rounded-md border border-border object-contain"
          src={src}
          alt={attachment.originalFilename || 'Изображение'}
        />
      </a>
    );
  }
  return (
    <a
      className="mt-1 inline-flex break-all text-sm text-brand hover:underline"
      href={src}
      download={attachment.originalFilename || true}
    >
      {attachment.originalFilename || 'Скачать файл'}
    </a>
  );
}

export default function ChatMessagePane({
  chat,
  messages,
  typingUserIds,
  currentUserId,
  historyStatus = 'idle',
  historyError = null,
  loadingOlder = false,
  hasMoreOlder = false,
  onLoadOlder,
  onBack,
  onOpenInfo,
  onPin,
  onMarkRead,
}) {
  const bottomRef = useRef(null);
  const topSentinelRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const markedForChatRef = useRef(null);

  useEffect(() => {
    markedForChatRef.current = null;
  }, [chat?.id]);

  useEffect(() => {
    if (!chat?.id || historyStatus !== 'ready') return;
    const last = messages.at(-1);
    if (!last?.id) return;
    if (markedForChatRef.current === `${chat.id}:${last.id}`) return;
    markedForChatRef.current = `${chat.id}:${last.id}`;
    onMarkRead(last.id);
  }, [chat?.id, historyStatus, messages, onMarkRead]);

  useEffect(() => {
    if (historyStatus !== 'ready') return;
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, historyStatus, chat?.id]);

  useEffect(() => {
    const node = topSentinelRef.current;
    if (!node || !onLoadOlder || !hasMoreOlder || historyStatus !== 'ready') return undefined;
    const root = node.closest('[data-radix-scroll-area-viewport]') || null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          stickToBottomRef.current = false;
          onLoadOlder();
        }
      },
      { root, rootMargin: '40px 0px 0px 0px', threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onLoadOlder, hasMoreOlder, historyStatus, chat?.id]);

  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Выберите чат из списка или найдите собеседника.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2 sm:px-3">
        {onBack ? (
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden shrink-0"
            onClick={onBack}
            aria-label="К списку чатов"
          >
            <ArrowLeft />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{chat.title}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {chat.description || String(chat.kind || '').replace('_', ' ')}
          </p>
        </div>
        {onOpenInfo ? (
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden shrink-0"
            onClick={onOpenInfo}
            aria-label="Информация о чате"
          >
            <Info />
          </Button>
        ) : null}
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div
          className="space-y-3 px-3 py-4 sm:px-4"
          onScrollCapture={(event) => {
            const el =
              event.target?.closest?.('[data-radix-scroll-area-viewport]') ||
              event.currentTarget;
            if (!el || typeof el.scrollTop !== 'number') return;
            const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
            stickToBottomRef.current = distance < 80;
          }}
        >
          <div ref={topSentinelRef} />
          {historyStatus === 'loading' && messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Загрузка истории…</p>
          ) : null}
          {historyStatus === 'error' && messages.length === 0 ? (
            <p className="text-center text-sm text-destructive">
              {historyError || 'Не удалось загрузить историю'}
            </p>
          ) : null}
          {historyStatus === 'ready' && messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Пока нет сообщений</p>
          ) : null}
          {loadingOlder ? (
            <p className="text-center text-xs text-muted-foreground">Загрузка истории…</p>
          ) : null}
          {!hasMoreOlder && messages.length > 0 ? (
            <p className="text-center text-[11px] text-muted-foreground">Начало переписки</p>
          ) : null}
          {messages.map((message) => {
            const own = message.senderUserId === currentUserId;
            if (message.type === 'system') {
              return (
                <p key={message.id} className="text-center text-xs text-muted-foreground">
                  {message.body}
                </p>
              );
            }
            return (
              <article key={message.id} className="group flex gap-2">
                <div className="min-w-0 max-w-[min(100%,46rem)]">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className={own ? 'text-sm font-semibold text-brand' : 'text-sm font-semibold'}>
                      {own ? 'Вы' : senderName(message)}
                    </span>
                    <time className="text-[11px] text-muted-foreground">
                      {message.createdAt
                        ? new Date(message.createdAt).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </time>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-100 md:h-5 md:w-5 md:opacity-0 md:group-hover:opacity-100"
                      onClick={() => onPin(message.id)}
                      aria-label="Закрепить сообщение"
                    >
                      <Pin className="h-3 w-3" />
                    </Button>
                  </div>
                  {CRM_TYPES.has(message.type) ? (
                    <CrmMessageCard message={message} />
                  ) : message.body ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p>
                  ) : null}
                  {message.attachments?.map((attachment) => (
                    <Attachment key={attachment.id} attachment={attachment} />
                  ))}
                  {message.editedAt ? (
                    <span className="text-[10px] text-muted-foreground">изменено</span>
                  ) : null}
                </div>
              </article>
            );
          })}
          {typingUserIds.length ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Собеседник печатает…
            </p>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
