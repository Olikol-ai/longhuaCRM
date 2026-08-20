import { memo, useRef } from 'react';
import { displayUserName } from '@/lib/chat-normalize';
import { formatMessageTime } from '@/lib/chat/dates';
import { isImageAttachment, isGifAttachment, isStickerAttachment, isVoiceAttachment } from '@/lib/chat/file-kind';
import { firstUrl, splitLinks } from '@/lib/chat/links';
import { isTeacherRole } from '@/lib/chat/presence-line';
import { highlightQuery } from '@/lib/chat/preview';
import { REACTION_SET } from '@/lib/chat/reactions';
import { cn } from '@/lib/utils';
import ChatAttachment from './ChatAttachment';
import ChatAvatar from './ChatAvatar';
import CrmMessageCard from './CrmMessageCard';

function isEmojiOnly(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  try {
    const compact = value.replace(/\s/g, '');
    if ([...compact].length > 8) return false;
    return /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\u200D)+$/u.test(compact);
  } catch {
    return false;
  }
}

function MessageText({ text, query, own, emojiOnly }) {
  if (!text) return null;
  const className = cn(
    'whitespace-pre-wrap break-words text-[15px] leading-[1.45]',
    own ? 'text-white' : 'text-foreground',
    emojiOnly && 'lh-chat-emoji-only text-center',
  );
  if (query) {
    return (
      <p className={className}>
        {highlightQuery(text, query).map((part, index) =>
          part.hit ? (
            <mark key={index} className="rounded-sm bg-brand-gold-soft text-foreground">
              {part.text}
            </mark>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
    );
  }
  return (
    <p className={className}>
      {splitLinks(text).map((part, index) =>
        part.type === 'link' ? (
          <a
            key={index}
            href={part.value}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'break-all underline underline-offset-2',
              own ? 'text-white' : 'text-brand',
            )}
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  );
}

function bubbleTone(own, role) {
  if (own) return 'lh-chat-bubble--own';
  if (isTeacherRole(role)) return 'lh-chat-bubble--other lh-chat-bubble--teacher text-foreground';
  return 'lh-chat-bubble--other text-foreground';
}

function ChatMessageBubble({
  message,
  own,
  showAvatar,
  showName,
  chatKind,
  bodyText,
  decryptError,
  decrypting,
  replyPreview,
  reactions = [],
  searchQuery,
  selected,
  fresh = false,
  onContextMenu,
  onOpenImage,
  onReact,
  onJumpReply,
  imageGallery = [],
  mediaLocked = false,
  onNeedUnlock,
}) {
  const pressRef = useRef(null);
  const role = message.senderUser?.role;
  const url = firstUrl(bodyText);
  const crmType =
    message.type === 'lesson' ||
    message.type === 'homework' ||
    message.type === 'exam' ||
    message.type === 'material';
  const emojiOnly =
    !message.attachments?.length &&
    !decryptError &&
    !decrypting &&
    !crmType &&
    isEmojiOnly(bodyText);
  const mediaOnly =
    !bodyText &&
    !crmType &&
    !decryptError &&
    !decrypting &&
    !mediaLocked &&
    !replyPreview &&
    Array.isArray(message.attachments) &&
    message.attachments.length > 0 &&
    message.attachments.every(
      (attachment) =>
        isImageAttachment(attachment) ||
        isGifAttachment(attachment) ||
        isStickerAttachment(attachment),
    );
  const voiceOnly =
    !bodyText &&
    !crmType &&
    !decryptError &&
    !decrypting &&
    !mediaLocked &&
    !replyPreview &&
    Array.isArray(message.attachments) &&
    message.attachments.length === 1 &&
    isVoiceAttachment(message.attachments[0]);

  const openMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.getSelection?.()?.removeAllRanges?.();
    onContextMenu?.({
      x: event.clientX || event.touches?.[0]?.clientX || 0,
      y: event.clientY || event.touches?.[0]?.clientY || 0,
      message,
      own,
      bodyText,
    });
  };

  return (
    <article
      id={`msg-${message.id}`}
      data-message-id={message.id}
      className={cn(
        'lh-chat-msg group relative flex gap-2.5 px-3 py-1 sm:px-5',
        own ? 'justify-end' : 'justify-start',
        selected && 'rounded-2xl bg-brand-soft/45',
        fresh && 'lh-chat-msg--enter',
        fresh && (own ? 'lh-chat-msg--enter-own' : 'lh-chat-msg--enter-peer'),
      )}
      onContextMenu={openMenu}
      onTouchStart={(event) => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        pressRef.current = window.setTimeout(() => {
          pressRef.current = 0;
          // Block iOS callout / text selection when opening the action sheet.
          window.getSelection?.()?.removeAllRanges?.();
          onContextMenu?.({
            x: touch.clientX,
            y: touch.clientY,
            message,
            own,
            bodyText,
          });
        }, 480);
      }}
      onTouchEnd={() => {
        if (pressRef.current) window.clearTimeout(pressRef.current);
        pressRef.current = 0;
      }}
      onTouchMove={() => {
        if (pressRef.current) window.clearTimeout(pressRef.current);
        pressRef.current = 0;
      }}
      onTouchCancel={() => {
        if (pressRef.current) window.clearTimeout(pressRef.current);
        pressRef.current = 0;
      }}
    >
      {!own && showAvatar ? (
        <ChatAvatar user={message.senderUser} size="sm" className="mt-7 self-end" />
      ) : !own ? (
        <span className="w-8 shrink-0" aria-hidden />
      ) : null}
      <div className={cn('relative min-w-0 max-w-[min(100%,34rem)]', own && 'items-end')}>
        {showName && !own ? (
          <p className="mb-1 max-w-full truncate px-1.5 text-[12px] font-medium text-muted-foreground">
            {displayUserName(message.senderUser)}
            {isTeacherRole(role) ? ' · преподаватель' : ''}
          </p>
        ) : null}
        <div
          className={cn(
            'lh-chat-bubble',
            bubbleTone(own, role),
            emojiOnly && 'bg-transparent border-0 shadow-none px-1 py-0',
            mediaOnly && 'lh-chat-bubble--media',
            voiceOnly && 'lh-chat-bubble--voice',
          )}
        >
          {replyPreview ? (
            <button
              type="button"
              className={cn(
                'mb-2 w-full rounded-xl border-l-[3px] px-2.5 py-1.5 text-left text-xs transition-colors',
                own ? 'border-white/80 bg-white/12 hover:bg-white/18' : 'border-brand bg-background/55 hover:bg-background/85',
              )}
              onClick={() => onJumpReply?.(message.replyToMessageId)}
            >
              <span className="block truncate font-semibold">{replyPreview.author}</span>
              <span className="line-clamp-2 opacity-80">{replyPreview.text}</span>
            </button>
          ) : null}
          {crmType ? (
            <CrmMessageCard message={message} />
          ) : decryptError ? (
            <p className={cn('text-sm', own ? 'text-white/90' : 'text-destructive')}>{decryptError}</p>
          ) : decrypting ? (
            <p className={cn('text-sm', own ? 'text-white/80' : 'text-muted-foreground')}>Расшифровка…</p>
          ) : (
            <MessageText text={bodyText} query={searchQuery} own={own} emojiOnly={emojiOnly} />
          )}
          {url && !searchQuery && !emojiOnly ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'mt-2 block truncate rounded-xl px-2.5 py-2 text-[11px]',
                own ? 'bg-white/12 text-white/90' : 'bg-background/70 text-muted-foreground',
              )}
            >
              {url.replace(/^https?:\/\//, '')}
            </a>
          ) : null}
          {message.attachments?.map((attachment) => {
            const imageIndex = isImageAttachment(attachment)
              ? imageGallery.findIndex((item) => item.id === attachment.id)
              : -1;
            return (
              <ChatAttachment
                key={attachment.id}
                attachment={attachment}
                own={own}
                mediaLocked={mediaLocked}
                onNeedUnlock={onNeedUnlock}
                imageIndex={imageIndex >= 0 ? imageIndex : 0}
                onOpenImage={(idx) => {
                  if (mediaLocked) {
                    onNeedUnlock?.();
                    return;
                  }
                  onOpenImage?.(idx);
                }}
              />
            );
          })}
          {!emojiOnly && !voiceOnly ? (
            <div
              className={cn(
                'mt-1.5 flex items-center justify-end gap-1.5 text-[11px] leading-none',
                own ? 'text-white/70' : 'text-muted-foreground',
                mediaOnly && (own ? 'pr-1 text-white/90 drop-shadow' : 'pr-1'),
              )}
            >
              {message.editedAt ? <span>изм.</span> : null}
              <time dateTime={message.createdAt || undefined}>{formatMessageTime(message.createdAt)}</time>
              {own ? (
                <span
                  className="lh-chat-ticks"
                  aria-label={chatKind === 'direct' ? 'Доставлено' : 'Отправлено'}
                >
                  {chatKind === 'direct' ? '✓✓' : '✓'}
                </span>
              ) : null}
            </div>
          ) : null}
          {voiceOnly ? (
            <div
              className={cn(
                'mt-1 flex items-center justify-end gap-1 px-1 text-[10px]',
                own ? 'text-brand' : 'text-muted-foreground',
              )}
            >
              <time dateTime={message.createdAt || undefined}>{formatMessageTime(message.createdAt)}</time>
              {own ? (
                <span className="lh-chat-ticks" aria-label={chatKind === 'direct' ? 'Доставлено' : 'Отправлено'}>
                  {chatKind === 'direct' ? '✓✓' : '✓'}
                </span>
              ) : null}
            </div>
          ) : null}
          {emojiOnly ? (
            <div
              className={cn(
                'mt-1 flex items-center justify-end gap-1 text-[10px]',
                own ? 'text-brand' : 'text-muted-foreground',
              )}
            >
              <time dateTime={message.createdAt || undefined}>{formatMessageTime(message.createdAt)}</time>
            </div>
          ) : null}
        </div>

        {reactions.length ? (
          <div className={cn('mt-1.5 flex flex-wrap gap-1', own && 'justify-end')} aria-label="Реакции">
            {reactions.map((row) => (
              <button
                key={row.emoji}
                type="button"
                className={cn(
                  'lh-chat-reaction lh-chat-reaction--pop inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-2.5 text-sm shadow-sm',
                  row.mine ? 'border-brand bg-brand-soft' : 'border-border/80 bg-card/95',
                )}
                aria-pressed={row.mine}
                onClick={() => onReact?.(message.id, row.emoji)}
              >
                <span>{row.emoji}</span>
                <span className="text-xs tabular-nums">{row.count}</span>
              </button>
            ))}
            <button
              type="button"
              className="lh-chat-reaction inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border/80 bg-card/95 text-sm shadow-sm"
              aria-label="Добавить реакцию"
              onClick={() => onReact?.(message.id, 'more')}
            >
              +
            </button>
          </div>
        ) : (
          <div
            className={cn(
              'pointer-events-none absolute top-full z-10 mt-1.5 hidden gap-0.5 opacity-0 transition-opacity duration-150 md:pointer-events-auto md:flex md:group-hover:opacity-100',
              own ? 'right-0' : 'left-0',
            )}
          >
            {REACTION_SET.slice(0, 4).map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="lh-chat-reaction inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border/80 bg-card text-base shadow-md hover:bg-muted"
                aria-label={`Реакция ${emoji}`}
                onClick={() => onReact?.(message.id, emoji)}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              className="lh-chat-reaction inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border/80 bg-card text-sm shadow-md hover:bg-muted"
              aria-label="Другая реакция"
              onClick={() => onReact?.(message.id, 'more')}
            >
              +
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default memo(ChatMessageBubble);
