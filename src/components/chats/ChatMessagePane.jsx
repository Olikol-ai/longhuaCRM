import { Info, Menu, Pin, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { chatsApi } from '@/api/chats.api';
import { getToken } from '@/api/http';
import CrmMessageCard from './CrmMessageCard';
import VoicePlayer from './VoicePlayer';

const CRM_TYPES = new Set(['lesson', 'homework', 'exam', 'material']);

function senderName(message) {
  const sender = message.senderUser;
  if (!sender) return message.type === 'ai_response' ? 'Longhua AI' : 'Система';
  return [sender.lastName, sender.firstName].filter(Boolean).join(' ') || sender.email || 'Пользователь';
}

function Attachment({ attachment }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let active = true;
    let objectUrl = null;
    void fetch(chatsApi.downloadUrl(attachment.id), {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(async (response) => {
      if (!response.ok) throw new Error('Attachment download failed');
      objectUrl = URL.createObjectURL(await response.blob());
      if (active) setUrl(objectUrl);
    }).catch(() => setUrl(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);
  if (attachment.kind === 'voice') return <VoicePlayer attachment={attachment} />;
  if (!url) return <span className="mt-1 block text-xs text-muted-foreground">Загрузка вложения…</span>;
  if (attachment.kind === 'image') {
    return <a href={url} target="_blank" rel="noreferrer"><img className="mt-1 max-h-64 rounded-md border border-border" src={url} alt={attachment.originalFilename || 'Изображение'} /></a>;
  }
  return <a className="mt-1 inline-flex text-sm text-brand hover:underline" href={url} download={attachment.originalFilename || true}>{attachment.originalFilename || 'Скачать файл'}</a>;
}

export default function ChatMessagePane({
  chat,
  messages,
  typingUserIds,
  currentUserId,
  onOpenSidebar,
  onOpenInfo,
  onPin,
  onMarkRead,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
    const last = messages.at(-1);
    if (last?.id) onMarkRead(last.id);
  }, [messages, onMarkRead]);

  if (!chat) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Выберите чат слева или найдите собеседника.</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <Button size="icon" variant="ghost" className="lg:hidden" onClick={onOpenSidebar} aria-label="Открыть чаты"><Menu /></Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{chat.title}</h2>
          <p className="truncate text-xs text-muted-foreground">{chat.description || chat.kind.replace('_', ' ')}</p>
        </div>
        <Button size="icon" variant="ghost" className="lg:hidden" onClick={onOpenInfo} aria-label="Открыть информацию"><Info /></Button>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 px-4 py-4">
          {messages.map((message) => {
            const own = message.senderUserId === currentUserId;
            if (message.type === 'system') return <p key={message.id} className="text-center text-xs text-muted-foreground">{message.body}</p>;
            return (
              <article key={message.id} className="group flex gap-2">
                <div className="min-w-0 max-w-[min(100%,46rem)]">
                  <div className="flex items-baseline gap-2">
                    <span className={own ? 'text-sm font-semibold text-brand' : 'text-sm font-semibold'}>{own ? 'Вы' : senderName(message)}</span>
                    <time className="text-[11px] text-muted-foreground">{new Date(message.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>
                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => onPin(message.id)} aria-label="Закрепить сообщение"><Pin className="h-3 w-3" /></Button>
                  </div>
                  {CRM_TYPES.has(message.type) ? <CrmMessageCard message={message} /> : message.body ? <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p> : null}
                  {message.attachments?.map((attachment) => <Attachment key={attachment.id} attachment={attachment} />)}
                  {message.editedAt ? <span className="text-[10px] text-muted-foreground">изменено</span> : null}
                </div>
              </article>
            );
          })}
          {typingUserIds.length ? <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Собеседник печатает…</p> : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
