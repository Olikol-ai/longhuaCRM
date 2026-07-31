import { ArrowLeft, Download, FileText, Info, Lock, Pin, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  chatAttachmentDownloadSrc,
  chatAttachmentSrc,
} from '@/lib/chat-attachment-url';
import { displayUserName, pickField } from '@/lib/chat-normalize';
import { resolveDirectPeerPublicKey } from '@/lib/e2ee/dm';
import { useE2ee } from '@/lib/e2ee/E2eeContext';
import { decryptDirectMessage } from '@/lib/e2ee/message';
import { getMyPrivateKey } from '@/lib/e2ee/vault';
import { usePresence } from '@/lib/PresenceContext';
import { formatDirectPresence } from '@/lib/presence-format';
import { useChatAttachmentObjectUrl } from '@/lib/use-chat-attachment-object-url';
import { cn } from '@/lib/utils';
import ChatMediaLightbox from './ChatMediaLightbox';
import CrmMessageCard from './CrmMessageCard';
import VoicePlayer from './VoicePlayer';

const CRM_TYPES = new Set(['lesson', 'homework', 'exam', 'material']);
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const PDF_EXT = /\.pdf$/i;

function senderName(message) {
  const sender = message.senderUser;
  if (!sender) return 'Система';
  return displayUserName(sender);
}

function isImageAttachment(attachment) {
  if (attachment.kind === 'image') return true;
  const mime = String(attachment.mime || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return IMAGE_EXT.test(attachment.originalFilename || attachment.original_filename || '');
}

function isVideoAttachment(attachment) {
  const mime = String(attachment.mime || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  return VIDEO_EXT.test(attachment.originalFilename || attachment.original_filename || '');
}

function isPdfAttachment(attachment) {
  const mime = String(attachment.mime || '').toLowerCase();
  if (mime === 'application/pdf') return true;
  return PDF_EXT.test(attachment.originalFilename || attachment.original_filename || '');
}

function Attachment({
  attachment,
  imageItems,
  imageIndex,
  onOpenImage,
}) {
  const isVoice = attachment.kind === 'voice';
  const isVideo = !isVoice && isVideoAttachment(attachment);
  const needsObjectUrl = isVideo;
  const {
    src: objectSrc,
    error: objectError,
    loading: objectLoading,
  } = useChatAttachmentObjectUrl(needsObjectUrl ? attachment.id : null);
  const querySrc = chatAttachmentSrc(attachment.id);
  const downloadSrc = chatAttachmentDownloadSrc(attachment.id);
  const name = attachment.originalFilename || attachment.original_filename || 'Файл';

  if (isVoice) return <VoicePlayer attachment={attachment} />;

  if (isImageAttachment(attachment)) {
    if (!querySrc) {
      return <span className="mt-1 block text-xs text-muted-foreground">Вложение недоступно</span>;
    }
    return (
      <div className="mt-1 space-y-1">
        <button
          type="button"
          className="block max-w-full overflow-hidden rounded-md border border-border text-left"
          onClick={() => onOpenImage?.(imageIndex ?? 0)}
        >
          <img
            className="max-h-64 max-w-full object-contain"
            src={querySrc}
            alt={name}
          />
        </button>
        <a
          className="inline-flex min-h-9 items-center gap-1 text-xs text-muted-foreground hover:text-brand"
          href={downloadSrc}
          download={name}
        >
          <Download className="h-3.5 w-3.5" /> Скачать
        </a>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="mt-1 max-w-full space-y-1">
        {objectLoading ? (
          <p className="text-xs text-muted-foreground">Загрузка видео…</p>
        ) : null}
        {objectError ? (
          <p className="text-xs text-destructive">{objectError}</p>
        ) : null}
        {objectSrc ? (
          <video
            className="max-h-72 w-full max-w-md rounded-md border border-border bg-black"
            src={objectSrc}
            controls
            playsInline
            preload="metadata"
          >
            Ваш браузер не поддерживает видео.
          </video>
        ) : null}
        <a
          className="inline-flex min-h-9 items-center gap-1 text-xs text-muted-foreground hover:text-brand"
          href={downloadSrc}
          download={name}
        >
          <Download className="h-3.5 w-3.5" /> Скачать
        </a>
      </div>
    );
  }

  if (!querySrc) {
    return <span className="mt-1 block text-xs text-muted-foreground">Вложение недоступно</span>;
  }

  const src = querySrc;

  if (isPdfAttachment(attachment)) {
    return (
      <div className="mt-1 space-y-1">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-brand hover:bg-muted"
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">{name}</span>
          <span className="text-xs text-muted-foreground">Открыть PDF</span>
        </a>
        <a
          className="inline-flex min-h-9 items-center gap-1 text-xs text-muted-foreground hover:text-brand"
          href={downloadSrc}
          download={name}
        >
          <Download className="h-3.5 w-3.5" /> Скачать
        </a>
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <a
        className={cn(
          'inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm',
        )}
        href={src}
        target="_blank"
        rel="noreferrer"
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">{name}</span>
      </a>
      <a
        className="inline-flex min-h-9 items-center gap-1 text-xs text-muted-foreground hover:text-brand"
        href={downloadSrc}
        download={name}
      >
        <Download className="h-3.5 w-3.5" /> Скачать
      </a>
    </div>
  );
}

function MessageBody({
  message,
  isDirect,
  decryptedBody,
  decryptError,
}) {
  if (CRM_TYPES.has(message.type)) {
    return <CrmMessageCard message={message} />;
  }
  if (isDirect && message.ciphertext) {
    if (decryptError) {
      return <p className="text-sm text-destructive">{decryptError}</p>;
    }
    if (decryptedBody == null) {
      return <p className="text-sm text-muted-foreground">Расшифровка…</p>;
    }
    return (
      <p className="whitespace-pre-wrap break-words text-sm leading-5">{decryptedBody}</p>
    );
  }
  if (message.body) {
    return <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p>;
  }
  return null;
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
  onNeedUnlock,
  members = [],
}) {
  const { ready: e2eeReady } = useE2ee();
  const { isUserOnline, countOnlineAmong } = usePresence();
  const bottomRef = useRef(null);
  const topSentinelRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const markedForChatRef = useRef(null);
  const [plaintextById, setPlaintextById] = useState({});
  const [errorsById, setErrorsById] = useState({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const isDirect = chat?.kind === 'direct';

  const imageGallery = useMemo(() => {
    const items = [];
    for (const message of messages || []) {
      for (const attachment of message.attachments || []) {
        if (!isImageAttachment(attachment)) continue;
        const src = chatAttachmentSrc(attachment.id);
        if (!src) continue;
        items.push({
          id: attachment.id,
          src,
          name: attachment.originalFilename || attachment.original_filename || 'Изображение',
          downloadSrc: chatAttachmentDownloadSrc(attachment.id),
        });
      }
    }
    return items;
  }, [messages]);

  const subtitle = useMemo(() => {
    if (!chat) return '';
    if (chat.kind === 'direct') {
      const peer = members
        .map((m) => pickField(m, 'user') || {})
        .find((u) => u?.id && u.id !== currentUserId);
      const peerOnline = peer?.id ? isUserOnline(peer.id) : false;
      const lastSeen = pickField(peer, 'lastSeenAt', 'last_seen_at');
      return formatDirectPresence(lastSeen, peerOnline);
    }
    const memberUserIds =
      (chat.memberUserIds || []).length
        ? chat.memberUserIds
        : members
            .map((m) => pickField(m, 'userId', 'user_id') || pickField(m, 'user')?.id)
            .filter(Boolean);
    const memberCount = chat.memberCount ?? members.length;
    const onlineCount = countOnlineAmong(memberUserIds);
    return `Участников: ${memberCount} · Онлайн: ${onlineCount}`;
  }, [chat, members, currentUserId, isUserOnline, countOnlineAmong]);

  useEffect(() => {
    markedForChatRef.current = null;
  }, [chat?.id]);

  useEffect(() => {
    if (!chat?.id || historyStatus !== 'ready') return;
    // Prefer explicit latest loaded message; if history is empty, still ask
    // the server to mark up to its own latest cursor.
    const last = messages.at(-1);
    const markKey = `${chat.id}:${last?.id || 'empty'}`;
    if (markedForChatRef.current === markKey) return;
    markedForChatRef.current = markKey;
    onMarkRead?.(last?.id || null);
  }, [chat?.id, historyStatus, messages, onMarkRead]);

  useEffect(() => {
    if (historyStatus !== 'ready') return;
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, historyStatus, chat?.id, plaintextById]);

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

  useEffect(() => {
    setPlaintextById({});
    setErrorsById({});
  }, [chat?.id]);

  useEffect(() => {
    if (!isDirect || !chat?.id || !e2eeReady) return undefined;
    const pending = messages.filter(
      (message) =>
        message.ciphertext &&
        message.nonce &&
        plaintextById[message.id] == null &&
        errorsById[message.id] == null,
    );
    if (!pending.length) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const peerHint = (chat.memberUserIds || []).find(
          (id) => id && id !== currentUserId,
        );
        const peer = await resolveDirectPeerPublicKey(chat.id, currentUserId, peerHint);
        const privateKey = getMyPrivateKey();
        const nextPlain = {};
        const nextErr = {};
        for (const message of pending) {
          try {
            nextPlain[message.id] = await decryptDirectMessage({
              ciphertextB64: message.ciphertext,
              nonceB64: message.nonce,
              myPrivateKey: privateKey,
              peerPublicKeyB64: peer.publicKey,
              chatId: chat.id,
            });
          } catch {
            nextErr[message.id] = 'Не удалось расшифровать сообщение';
          }
        }
        if (cancelled) return;
        if (Object.keys(nextPlain).length) {
          setPlaintextById((prev) => ({ ...prev, ...nextPlain }));
        }
        if (Object.keys(nextErr).length) {
          setErrorsById((prev) => ({ ...prev, ...nextErr }));
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'E2EE',
            description: err?.message || 'Нет ключей собеседника',
            variant: 'destructive',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isDirect,
    chat?.id,
    currentUserId,
    e2eeReady,
    messages,
    plaintextById,
    errorsById,
  ]);

  const encryptedCount = useMemo(
    () => messages.filter((m) => m.ciphertext).length,
    [messages],
  );

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
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
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
      {isDirect ? (
        <div className="flex items-start gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          <p>
            Личные сообщения защищены сквозным шифрованием. Сервер хранит только шифротекст —
            администраторы не могут прочитать переписку.
            {!e2eeReady ? (
              <>
                {' '}
                <button
                  type="button"
                  className="font-medium text-brand underline-offset-2 hover:underline"
                  onClick={() => onNeedUnlock?.()}
                >
                  Разблокировать ключ
                </button>
              </>
            ) : null}
          </p>
        </div>
      ) : null}
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
          {isDirect && !e2eeReady && encryptedCount > 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Введите пароль, чтобы прочитать {encryptedCount} зашифрованных сообщений.
            </p>
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
                  <MessageBody
                    message={message}
                    isDirect={isDirect}
                    decryptedBody={plaintextById[message.id]}
                    decryptError={
                      isDirect && message.ciphertext && !e2eeReady
                        ? 'Зашифрованное сообщение'
                        : errorsById[message.id]
                    }
                  />
                  {message.attachments?.map((attachment) => {
                    const imageIndex = isImageAttachment(attachment)
                      ? imageGallery.findIndex((item) => item.id === attachment.id)
                      : -1;
                    return (
                      <Attachment
                        key={attachment.id}
                        attachment={attachment}
                        imageIndex={imageIndex >= 0 ? imageIndex : 0}
                        onOpenImage={(idx) => {
                          setLightboxIndex(idx);
                          setLightboxOpen(true);
                        }}
                      />
                    );
                  })}
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
      <ChatMediaLightbox
        open={lightboxOpen}
        index={lightboxIndex}
        items={imageGallery}
        onClose={() => setLightboxOpen(false)}
        onDownload={(item) => {
          if (!item?.downloadSrc) return;
          const a = document.createElement('a');
          a.href = item.downloadSrc;
          a.download = item.name || 'image';
          a.rel = 'noopener';
          a.click();
        }}
      />
    </div>
  );
}
