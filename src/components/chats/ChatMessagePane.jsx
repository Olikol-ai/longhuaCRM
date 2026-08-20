import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Info, MessageCircle, Pin, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, EmptyState, IconButton, SearchField } from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import {
  chatAttachmentDownloadSrc,
  chatAttachmentSrc,
} from '@/lib/chat-attachment-url';
import { displayUserName, pickField } from '@/lib/chat-normalize';
import { resolveChatPeerUser, resolveChatTitle } from '@/lib/chat/titles';
import { formatDateSeparator, sameCalendarDay } from '@/lib/chat/dates';
import { isImageAttachment } from '@/lib/chat/file-kind';
import { canRevealChatMedia } from '@/lib/chat/media-gate';
import { formatChatPresence, formatGroupPresence } from '@/lib/chat/presence-line';
import { previewFromMessage } from '@/lib/chat/preview';
import {
  collectReactions,
  isReactionBody,
  REACTION_SET,
  resolveReactionAction,
} from '@/lib/chat/reactions';
import { resolveDirectPeerPublicKey } from '@/lib/e2ee/dm';
import { useE2ee } from '@/lib/e2ee/E2eeContext';
import { decryptDirectMessage } from '@/lib/e2ee/message';
import { getMyPrivateKey } from '@/lib/e2ee/vault';
import { usePresence } from '@/lib/PresenceContext';
import ChatAvatar from './ChatAvatar';
import ChatContextMenu from './ChatContextMenu';
import ChatDeleteDialog from './ChatDeleteDialog';
import ChatEmojiPicker from './ChatEmojiPicker';
import ChatMediaLightbox from './ChatMediaLightbox';
import ChatMessageBubble from './ChatMessageBubble';
import ChatTypingDots from './ChatTypingDots';

function visibleMessages(messages, plaintextById) {
  return (messages || []).filter((message) => {
    const body = plaintextById[message.id] ?? message.body;
    return !(message.replyToMessageId && isReactionBody(body));
  });
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
  onRefresh,
  onBack,
  onOpenInfo,
  onPin,
  onMarkRead,
  onNeedUnlock,
  members = [],
  pins = [],
  enableSwipeBack = false,
  onReply,
  onEdit,
  onForward,
  onDelete,
  onReact,
  selectedIds,
  onToggleSelect,
  onClearSelection,
}) {
  const { ready: e2eeReady } = useE2ee();
  const { isUserOnline, countOnlineAmong } = usePresence();
  const bottomRef = useRef(null);
  const topSentinelRef = useRef(null);
  const listRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const markedForChatRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, active: false });
  const pullRefreshRef = useRef({ y: 0, active: false });
  const [plaintextById, setPlaintextById] = useState({});
  const [errorsById, setErrorsById] = useState({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [menu, setMenu] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [reactFor, setReactFor] = useState(null);
  const [freshIds, setFreshIds] = useState(() => new Set());
  const [pull, setPull] = useState(0);
  const [refreshPull, setRefreshPull] = useState(0);
  const isDirect = chat?.kind === 'direct';
  const mediaUnlocked = canRevealChatMedia({ chatKind: chat?.kind, e2eeReady });
  const mediaLocked = isDirect && !mediaUnlocked;
  const selectedCount = selectedIds?.size || 0;

  const imageGallery = useMemo(() => {
    if (mediaLocked) return [];
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
  }, [messages, mediaLocked]);

  const headerPeer = useMemo(() => {
    return resolveChatPeerUser(chat, { currentUserId, members });
  }, [chat, members, currentUserId]);

  const headerTitle = useMemo(
    () => resolveChatTitle(chat, { currentUserId, members }),
    [chat, currentUserId, members],
  );

  const subtitle = useMemo(() => {
    if (!chat) return '';
    if (typingUserIds?.length) return 'печатает…';
    if (chat.kind === 'direct') {
      const peer = headerPeer || {};
      const peerOnline = peer?.id ? isUserOnline(peer.id) : false;
      const lastSeen = pickField(peer, 'lastSeenAt', 'last_seen_at');
      return formatChatPresence(lastSeen, peerOnline);
    }
    const memberUserIds =
      (chat.memberUserIds || []).length
        ? chat.memberUserIds
        : members
            .map((m) => pickField(m, 'userId', 'user_id') || pickField(m, 'user')?.id)
            .filter(Boolean);
    const memberCount = chat.memberCount ?? members.length;
    const onlineCount = countOnlineAmong(memberUserIds);
    return formatGroupPresence(memberCount, onlineCount);
  }, [chat, members, currentUserId, isUserOnline, countOnlineAmong, headerPeer, typingUserIds]);

  const listed = useMemo(
    () => visibleMessages(messages, plaintextById),
    [messages, plaintextById],
  );

  // Capture read cursor once per chat open — markRead clears unread on the server,
  // but the separator must still mark where unread started for this viewing session.
  const unreadAnchorRef = useRef({ chatId: null, lastReadId: null, unreadCount: 0 });
  if (chat?.id && unreadAnchorRef.current.chatId !== chat.id) {
    unreadAnchorRef.current = {
      chatId: chat.id,
      lastReadId:
        chat.lastReadMessageId ||
        chat.userState?.lastReadMessageId ||
        chat.user_state?.last_read_message_id ||
        null,
      unreadCount: Number(chat.unreadCount ?? chat.unread_count ?? 0) || 0,
    };
  }

  const firstUnreadMessageId = useMemo(() => {
    const anchor = unreadAnchorRef.current;
    if (!chat?.id || anchor.chatId !== chat.id) return null;
    if (!anchor.unreadCount || anchor.unreadCount < 1) return null;
    const cursor = anchor.lastReadId;
    let start = 0;
    if (cursor) {
      const cursorIdx = listed.findIndex((message) => message.id === cursor);
      start = cursorIdx >= 0 ? cursorIdx + 1 : 0;
    }
    for (let i = start; i < listed.length; i += 1) {
      const message = listed[i];
      if (!message || message.type === 'system') continue;
      if (message.senderUserId && message.senderUserId === currentUserId) continue;
      return message.id;
    }
    return null;
  }, [listed, chat?.id, currentUserId]);

  const reactionMap = useMemo(
    () => collectReactions(messages, currentUserId, plaintextById),
    [messages, currentUserId, plaintextById],
  );

  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return listed.filter((message) => {
      const body = plaintextById[message.id] ?? message.body ?? '';
      return String(body).toLowerCase().includes(q);
    });
  }, [listed, plaintextById, searchQuery]);

  useEffect(() => {
    markedForChatRef.current = null;
  }, [chat?.id]);

  useEffect(() => {
    if (mediaUnlocked) return;
    setPlaintextById({});
    setErrorsById({});
    setLightboxOpen(false);
    setMenu(null);
  }, [mediaUnlocked, chat?.id]);

  useEffect(() => {
    if (!chat?.id || historyStatus !== 'ready') return;
    const markKey = `${chat.id}:server-latest`;
    if (markedForChatRef.current === markKey) return;
    markedForChatRef.current = markKey;
    onMarkRead?.(null);
  }, [chat?.id, historyStatus, onMarkRead]);

  useEffect(() => {
    if (historyStatus !== 'ready') return;
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, historyStatus, chat?.id, plaintextById, typingUserIds?.length]);

  useEffect(() => {
    const lastId = messages?.length ? messages[messages.length - 1]?.id : null;
    if (!chat?.id) {
      lastMessageIdRef.current = null;
      setFreshIds(new Set());
      return;
    }
    if (lastId && lastMessageIdRef.current && lastId !== lastMessageIdRef.current) {
      setFreshIds((prev) => {
        const next = new Set(prev);
        next.add(lastId);
        if (next.size > 24) {
          const trimmed = [...next].slice(-16);
          return new Set(trimmed);
        }
        return next;
      });
    }
    lastMessageIdRef.current = lastId;
  }, [messages, chat?.id]);

  useEffect(() => {
    lastMessageIdRef.current = null;
    setFreshIds(new Set());
  }, [chat?.id]);

  useEffect(() => {
    const node = topSentinelRef.current;
    if (!node || !onLoadOlder || !hasMoreOlder || historyStatus !== 'ready') return undefined;
    const root = listRef.current;
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
    setSearchOpen(false);
    setSearchQuery('');
    setMenu(null);
    setReactFor(null);
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
            title: 'Не удалось расшифровать',
            description: err?.message || 'Откройте чат заново или разблокируйте ключи',
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

  useEffect(() => {
    if (!searchHits.length) return;
    const hit = searchHits[Math.min(searchIndex, searchHits.length - 1)];
    if (!hit) return;
    document.getElementById(`msg-${hit.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [searchIndex, searchHits]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f' && chat) {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (event.key !== 'Escape') return;
      if (menu) {
        setMenu(null);
        return;
      }
      if (reactFor) {
        setReactFor(null);
        return;
      }
      if (searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
        return;
      }
      if (selectedCount) {
        onClearSelection?.();
        return;
      }
      if (enableSwipeBack) onBack?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, reactFor, searchOpen, selectedCount, enableSwipeBack, onBack, onClearSelection, chat]);

  const encryptedCount = useMemo(
    () => messages.filter((m) => m.ciphertext).length,
    [messages],
  );

  const jumpTo = (messageId) => {
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const bodyOf = (message) => plaintextById[message?.id] ?? message?.body ?? '';

  const replyPreviewFor = (message) => {
    if (!message?.replyToMessageId || isReactionBody(bodyOf(message))) return null;
    const parent = (messages || []).find((item) => item.id === message.replyToMessageId);
    if (!parent) return { author: 'Сообщение', text: 'Ответ' };
    return {
      author: displayUserName(parent.senderUser),
      text: previewFromMessage(parent, { decryptedBody: plaintextById[parent.id] }).text || 'Сообщение',
    };
  };

  const applyReaction = (messageId, emoji) => {
    if (!emoji || emoji === 'more') {
      setReactFor(messageId);
      return;
    }
    const action = resolveReactionAction({
      messages,
      parentId: messageId,
      emoji,
      currentUserId,
      plaintextById,
    });
    void (async () => {
      if (action.type === 'remove') {
        await onDelete?.(action.messageId);
      } else if (action.type === 'replace') {
        await onDelete?.(action.removeId);
        await onReact?.(messageId, action.emoji);
      } else if (action.type === 'add') {
        await onReact?.(messageId, action.emoji);
      }
      setReactFor(null);
    })();
  };

  if (!chat) {
    return (
      <EmptyState
        className="lh-chat-empty"
        preset="messages"
        icon={MessageCircle}
        title="Выберите чат"
        description="Откройте диалог слева — переписка появится здесь."
      />
    );
  }

  const pinPreview = pins[0]
    ? previewFromMessage(pins[0].message || {}, {
        decryptedBody: plaintextById[pickField(pins[0], 'messageId', 'message_id')],
      }).text
    : '';

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background transition-transform duration-150"
      style={pull ? { transform: `translateX(${pull}px)` } : undefined}
      onTouchStart={(event) => {
        if (!enableSwipeBack) return;
        const x = event.touches[0].clientX;
        const y = event.touches[0].clientY;
        touchRef.current = { x, y, active: x < 28 };
      }}
      onTouchMove={(event) => {
        if (!enableSwipeBack || !touchRef.current.active) return;
        const x = event.touches[0].clientX;
        const y = event.touches[0].clientY;
        const dx = x - touchRef.current.x;
        const dy = Math.abs(y - touchRef.current.y);
        if (dy > 40) {
          touchRef.current.active = false;
          setPull(0);
          return;
        }
        if (dx > 0) setPull(Math.min(dx, 88));
      }}
      onTouchEnd={() => {
        if (!enableSwipeBack) return;
        if (pull > 56) onBack?.();
        setPull(0);
        touchRef.current.active = false;
      }}
    >
      <header className="lh-chat-header flex h-14 shrink-0 items-center gap-1 px-2 sm:px-3">
        {onBack ? (
          <IconButton
            className="shrink-0"
            onClick={onBack}
            label="К списку чатов"
          >
            <ArrowLeft />
          </IconButton>
        ) : null}
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 text-left transition-colors hover:bg-muted/45 active:bg-muted/60"
          onClick={() => onOpenInfo?.()}
        >
          <ChatAvatar
            user={headerPeer}
            title={headerTitle}
            kind={chat.kind}
            online={Boolean(headerPeer?.id && isUserOnline(headerPeer.id))}
            size="sm"
            className="shrink-0"
          />
          <span className="min-w-0 flex-1 overflow-hidden">
            <h2 className="truncate text-[15px] font-semibold tracking-tight">{headerTitle}</h2>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </span>
        </button>
        <IconButton
          label={searchOpen ? 'Закрыть поиск' : 'Поиск по сообщениям'}
          onClick={() => setSearchOpen((open) => !open)}
        >
          {searchOpen ? <X /> : <Search />}
        </IconButton>
        {onOpenInfo ? (
          <IconButton className="shrink-0" onClick={onOpenInfo} label="Информация о чате">
            <Info />
          </IconButton>
        ) : null}
      </header>

      {selectedCount > 0 ? (
        <div className="flex items-center gap-2 bg-brand-soft/60 px-3 py-2">
          <p className="min-w-0 flex-1 text-sm font-medium">{selectedCount} выбрано</p>
          <Button
            size="sm"
            intent="ghost"
            onClick={() => {
              const texts = listed
                .filter((message) => selectedIds.has(message.id))
                .map((message) => bodyOf(message))
                .filter(Boolean);
              if (texts.length) void navigator.clipboard.writeText(texts.join('\n'));
            }}
          >
            <Copy className="size-4" /> Копировать
          </Button>
          <Button size="sm" intent="ghost" onClick={() => onClearSelection?.()}>
            Отмена
          </Button>
        </div>
      ) : null}

      {searchOpen ? (
        <div className="flex items-center gap-2 bg-card/80 px-3 py-2">
          <SearchField
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchIndex(0);
            }}
            placeholder="Поиск в чате"
            aria-label="Поиск по сообщениям"
            autoFocus
          />
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {searchHits.length ? `${searchIndex + 1}/${searchHits.length}` : '0'}
          </span>
          <IconButton
            label="Предыдущее совпадение"
            disabled={!searchHits.length}
            onClick={() =>
              setSearchIndex((index) => (index - 1 + searchHits.length) % searchHits.length)
            }
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            label="Следующее совпадение"
            disabled={!searchHits.length}
            onClick={() => setSearchIndex((index) => (index + 1) % searchHits.length)}
          >
            <ChevronRight />
          </IconButton>
        </div>
      ) : null}

      {pins.length ? (
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 bg-brand-soft/45 px-3 py-2 text-left transition-colors hover:bg-brand-soft/70"
          onClick={() => jumpTo(pickField(pins[0], 'messageId', 'message_id'))}
        >
          <Pin className="size-4 text-brand" />
          <span className="min-w-0 flex-1 truncate text-xs">
            {pinPreview || `${pins.length} закреплённых`}
          </span>
        </button>
      ) : null}

      {isDirect && !e2eeReady ? (
        <div className="flex items-center justify-between gap-2 bg-brand-soft/50 px-3 py-2">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            {encryptedCount > 0
              ? `Разблокируйте чат, чтобы читать сообщения`
              : 'Разблокируйте чат для переписки'}
          </p>
          <Button size="sm" intent="primary" onClick={() => onNeedUnlock?.()}>
            Разблокировать
          </Button>
        </div>
      ) : null}

      <div
        ref={listRef}
        className="lh-chat-canvas min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-chat-canvas
        role="log"
        aria-live="polite"
        onScroll={(event) => {
          const el = event.currentTarget;
          const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
          stickToBottomRef.current = distance < 80;
        }}
        onTouchStart={(event) => {
          const el = listRef.current;
          if (!el || el.scrollTop > 0 || !onRefresh) return;
          pullRefreshRef.current = { y: event.touches[0].clientY, active: true };
        }}
        onTouchMove={(event) => {
          if (!pullRefreshRef.current.active) return;
          const dy = event.touches[0].clientY - pullRefreshRef.current.y;
          if (dy > 0) setRefreshPull(Math.min(dy, 72));
          else {
            pullRefreshRef.current.active = false;
            setRefreshPull(0);
          }
        }}
        onTouchEnd={() => {
          if (refreshPull > 56) onRefresh?.();
          pullRefreshRef.current.active = false;
          setRefreshPull(0);
        }}
      >
        {refreshPull > 8 ? (
          <p className="py-2 text-center text-[11px] text-muted-foreground">
            {refreshPull > 56 ? 'Отпустите для обновления' : 'Потяните для обновления'}
          </p>
        ) : null}
        <div className="space-y-2 py-4">
          <div ref={topSentinelRef} />
          {historyStatus === 'loading' && messages.length === 0 ? (
            <div className="lh-chat-skeleton" aria-busy="true" aria-label="Загрузка истории">
              <div className="lh-chat-skeleton__row">
                <div className="lh-chat-skeleton__bubble lh-chat-skeleton__bubble--short" />
              </div>
              <div className="lh-chat-skeleton__row lh-chat-skeleton__row--own">
                <div className="lh-chat-skeleton__bubble lh-chat-skeleton__bubble--long" />
              </div>
              <div className="lh-chat-skeleton__row">
                <div className="lh-chat-skeleton__bubble lh-chat-skeleton__bubble--long" />
              </div>
              <div className="lh-chat-skeleton__row lh-chat-skeleton__row--own">
                <div className="lh-chat-skeleton__bubble lh-chat-skeleton__bubble--short" />
              </div>
              <div className="lh-chat-skeleton__row">
                <div className="lh-chat-skeleton__bubble lh-chat-skeleton__bubble--short" />
              </div>
            </div>
          ) : null}
          {historyStatus === 'error' && messages.length === 0 ? (
            <p className="px-4 text-center text-sm text-destructive">
              {historyError || 'Не удалось загрузить историю'}
            </p>
          ) : null}
          {historyStatus === 'ready' && listed.length === 0 ? (
            <EmptyState
              className="lh-chat-empty py-16"
              preset="messages"
              icon={MessageCircle}
              title="Начните диалог"
              description="Напишите первое сообщение — дальше всё как в мессенджере."
            />
          ) : null}
          {loadingOlder ? (
            <p className="text-center text-xs text-muted-foreground">Загрузка истории…</p>
          ) : null}
          {!hasMoreOlder && listed.length > 0 ? (
            <p className="text-center text-[11px] text-muted-foreground">Начало переписки</p>
          ) : null}
          {listed.map((message, index) => {
            const prev = listed[index - 1];
            const own = message.senderUserId === currentUserId;
            const showDay = !prev || !sameCalendarDay(prev.createdAt, message.createdAt);
            const showAvatar =
              !own && (!prev || prev.senderUserId !== message.senderUserId || showDay);
            const showName = showAvatar && chat.kind !== 'direct';
            if (message.type === 'system') {
              return (
                <div key={message.id}>
                  {showDay ? (
                    <p className="my-4 text-center text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-card/80 px-3.5 py-1.5 shadow-sm backdrop-blur-sm">
                        {formatDateSeparator(message.createdAt)}
                      </span>
                    </p>
                  ) : null}
                  <p className="px-6 py-1 text-center text-xs text-muted-foreground">{message.body}</p>
                </div>
              );
            }
            const bodyText = bodyOf(message);
            const reactions = [...(reactionMap.get(message.id)?.values() || [])];
            return (
              <div key={message.id}>
                {message.id === firstUnreadMessageId ? (
                  <div
                    className="lh-chat-unread-sep my-3 flex items-center gap-3 px-4"
                    role="separator"
                    aria-label="Непрочитанные сообщения"
                  >
                    <span className="h-px flex-1 bg-brand/35" />
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-brand">
                      Непрочитанные сообщения
                    </span>
                    <span className="h-px flex-1 bg-brand/35" />
                  </div>
                ) : null}
                {showDay ? (
                  <p className="my-4 text-center text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-card/80 px-3.5 py-1.5 shadow-sm backdrop-blur-sm">
                      {formatDateSeparator(message.createdAt)}
                    </span>
                  </p>
                ) : null}
                <ChatMessageBubble
                  message={message}
                  own={own}
                  showAvatar={showAvatar}
                  showName={showName}
                  chatKind={chat.kind}
                  bodyText={
                    isDirect && message.ciphertext && !e2eeReady
                      ? ''
                      : bodyText
                  }
                  decryptError={
                    isDirect && message.ciphertext && !e2eeReady
                      ? 'Зашифрованное сообщение'
                      : errorsById[message.id]
                  }
                  decrypting={Boolean(isDirect && message.ciphertext && e2eeReady && plaintextById[message.id] == null && !errorsById[message.id])}
                  replyPreview={replyPreviewFor(message)}
                  reactions={reactions}
                  searchQuery={searchQuery}
                  selected={Boolean(selectedIds?.has?.(message.id))}
                  fresh={freshIds.has(message.id)}
                  imageGallery={imageGallery}
                  mediaLocked={mediaLocked}
                  onNeedUnlock={onNeedUnlock}
                  onContextMenu={setMenu}
                  onOpenImage={(idx) => {
                    if (mediaLocked) {
                      onNeedUnlock?.();
                      return;
                    }
                    setLightboxIndex(idx);
                    setLightboxOpen(true);
                  }}
                  onReact={applyReaction}
                  onJumpReply={jumpTo}
                />
              </div>
            );
          })}
          {typingUserIds.length ? (
            <div className="flex justify-start px-3 py-1 sm:px-5" aria-live="polite">
              <span className="w-8 shrink-0" aria-hidden />
              <ChatTypingDots asBubble label="печатает…" />
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {reactFor
        ? createPortal(
            <div
              className="fixed inset-0 z-[75] flex flex-col justify-end"
              role="dialog"
              aria-modal="true"
              aria-label="Выбор реакции"
              data-testid="chat-reaction-sheet"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Закрыть"
                onClick={() => setReactFor(null)}
              />
              <div className="relative z-10 flex h-[min(72dvh,32rem)] max-h-[min(72dvh,32rem)] flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl safe-pb">
                <div className="flex shrink-0 items-center justify-between px-3 py-2">
                  <p className="text-xs font-medium">Реакция</p>
                  <IconButton label="Закрыть" onClick={() => setReactFor(null)}>
                    <X />
                  </IconButton>
                </div>
                <div className="flex shrink-0 gap-1 overflow-x-auto px-3 pb-2" aria-label="Частые реакции">
                  {REACTION_SET.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      tabIndex={-1}
                      className="lh-chat-reaction inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-lg hover:bg-muted"
                      onClick={() => applyReaction(reactFor, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <ChatEmojiPicker
                  className="min-h-0 flex-1 overflow-y-auto border-t border-border"
                  onPick={(emoji) => applyReaction(reactFor, emoji)}
                />
              </div>
            </div>,
            document.body,
          )
        : null}

      {menu ? (
        <ChatContextMenu
          x={menu.x}
          y={menu.y}
          own={menu.own}
          onClose={() => setMenu(null)}
          onAction={(id) => {
            const message = menu.message;
            const text = menu.bodyText || '';
            setMenu(null);
            window.getSelection?.()?.removeAllRanges?.();
            if (id === 'reply') onReply?.(message, text);
            if (id === 'react') setReactFor(message.id);
            if (id === 'edit') onEdit?.(message, text);
            if (id === 'pin') onPin?.(message.id);
            if (id === 'copy' && text) void navigator.clipboard.writeText(text);
            if (id === 'forward') onForward?.(message, text);
            if (id === 'select') onToggleSelect?.(message.id);
            if (id === 'delete') setDeleteId(message.id);
          }}
        />
      ) : null}

      <ChatDeleteDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={() => {
          if (deleteId) onDelete?.(deleteId);
          setDeleteId(null);
        }}
      />

      <ChatMediaLightbox
        open={lightboxOpen && !mediaLocked}
        index={lightboxIndex}
        items={imageGallery}
        onClose={() => setLightboxOpen(false)}
        onDownload={(item) => {
          if (mediaLocked || !item?.downloadSrc) return;
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
