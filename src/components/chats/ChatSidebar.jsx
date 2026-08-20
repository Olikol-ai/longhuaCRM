import {
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  MoreVertical,
  Paperclip,
  PenSquare,
  Pin,
  Star,
  VolumeX,
  Archive,
  BellOff,
} from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, EmptyState, IconButton, SearchField } from '@/design-system';
import { iconSize } from '@/design-system/tokens/icon';
import { formatChatListTime } from '@/lib/chat/dates';
import {
  getChatDraft,
  isChatArchived,
  isChatFavorite,
  isChatMuted,
  isChatPinned,
  sortChatsForList,
} from '@/lib/chat/prefs';
import { resolveChatPeerUser, resolveChatTitle } from '@/lib/chat/titles';
import { usePresence } from '@/lib/PresenceContext';
import { cn } from '@/lib/utils';
import ChatAvatar from './ChatAvatar';
import ChatListMenu from './ChatListMenu';
import ChatTypingDots from './ChatTypingDots';

const FILTERS = [
  { id: 'all', label: 'Активные' },
  { id: 'unread', label: 'Непрочитанные' },
  { id: 'favorites', label: 'Избранное' },
  { id: 'archive', label: 'Архив' },
];

function previewIcon(icon) {
  if (icon === 'homework') return ClipboardCheck;
  if (icon === 'lesson') return GraduationCap;
  if (icon === 'material') return BookOpen;
  if (icon === 'exam') return FileText;
  if (icon === 'file' || icon === 'image' || icon === 'voice') return Paperclip;
  return null;
}

/** Isolate list-row actions from ChatRow openChat (click must not bubble). */
function stopRowOpen(event) {
  event.preventDefault();
  event.stopPropagation();
}

const ChatRow = memo(function ChatRow({
  chat,
  active,
  currentUserId,
  preview,
  typing,
  onSelect,
  onMenu,
  onMute,
  onArchive,
}) {
  const { isUserOnline, countOnlineAmong } = usePresence();
  const swipeRef = useRef({ x: 0 });
  const [swipe, setSwipe] = useState(0);
  const memberUserIds = chat.memberUserIds || chat.member_user_ids || [];
  const peerId =
    chat.kind === 'direct'
      ? memberUserIds.find((id) => id && id !== currentUserId) || null
      : null;
  const online =
    chat.kind === 'direct'
      ? Boolean(peerId && isUserOnline(peerId))
      : countOnlineAmong(memberUserIds) > 0;
  const unreadCount = chat.unreadCount ?? chat.unread_count ?? 0;
  const muted = isChatMuted(chat);
  const pinned = isChatPinned(chat);
  const favorite = isChatFavorite(chat);
  const archived = isChatArchived(chat);
  const draft = getChatDraft(chat.id, currentUserId);
  const Icon = previewIcon(preview?.icon);
  const time = formatChatListTime(preview?.at || chat.updatedAt || chat.createdAt);
  const archiveLabel = archived ? 'Вернуть из архива' : 'Переместить в архив';
  const muteLabel = muted ? 'Включить звук' : 'Отключить уведомления';
  const peerUser = resolveChatPeerUser(chat, { currentUserId });
  const title = resolveChatTitle(chat, { currentUserId });

  let subtitle = preview?.text || chat.description || (chat.kind === 'direct' ? 'Личные сообщения' : '');
  if (draft) subtitle = `Черновик: ${draft}`;

  const runMute = (event) => {
    stopRowOpen(event);
    onMute?.(chat);
    setSwipe(0);
  };

  const runArchive = (event) => {
    stopRowOpen(event);
    onArchive?.(chat);
    setSwipe(0);
  };

  const runMore = (event) => {
    stopRowOpen(event);
    const rect = event.currentTarget.getBoundingClientRect();
    onMenu({
      x: rect.right - 8,
      y: rect.bottom + 4,
      chat,
    });
  };

  return (
    <div className="group relative overflow-hidden">
      {/* Mobile swipe actions (revealed under the row). */}
      <div className="absolute inset-y-0 right-0 flex md:hidden" aria-hidden={swipe < 40}>
        <button
          type="button"
          className="flex min-h-full min-w-[4.5rem] flex-col items-center justify-center gap-1 bg-muted px-3 text-[10px] font-medium text-foreground"
          aria-label={muteLabel}
          onClick={runMute}
          onPointerDown={stopRowOpen}
        >
          <BellOff className={iconSize.sm} aria-hidden />
          {muted ? 'Звук' : 'Без звука'}
        </button>
        <button
          type="button"
          className="flex min-h-full min-w-[4.5rem] flex-col items-center justify-center gap-1 bg-brand px-3 text-[10px] font-medium text-white"
          aria-label={archiveLabel}
          onClick={runArchive}
          onPointerDown={stopRowOpen}
        >
          <Archive className={iconSize.sm} aria-hidden />
          {archived ? 'Вернуть' : 'Архив'}
        </button>
      </div>

      {/* Desktop hover actions — above the row so clicks never open the chat. */}
      <div
        className={cn(
          'pointer-events-none absolute right-2 top-1/2 z-[2] hidden -translate-y-1/2 items-center gap-0.5',
          'opacity-0 transition-opacity duration-150',
          'md:flex md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100',
        )}
      >
        <IconButton
          type="button"
          intent="ghost"
          label={muteLabel}
          className="bg-card/95 shadow-sm"
          onClick={runMute}
          onPointerDown={stopRowOpen}
        >
          <BellOff />
        </IconButton>
        <IconButton
          type="button"
          intent="ghost"
          label={archiveLabel}
          className="bg-card/95 shadow-sm"
          onClick={runArchive}
          onPointerDown={stopRowOpen}
        >
          <Archive />
        </IconButton>
        <IconButton
          type="button"
          intent="ghost"
          label="Ещё"
          className="bg-card/95 shadow-sm"
          onClick={runMore}
          onPointerDown={stopRowOpen}
        >
          <MoreVertical />
        </IconButton>
      </div>

      <button
        type="button"
        onClick={() => {
          if (swipe > 40) {
            setSwipe(0);
            return;
          }
          onSelect(chat);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onMenu({
            x: event.clientX,
            y: event.clientY,
            chat,
          });
        }}
        onTouchStart={(event) => {
          swipeRef.current = { x: event.touches[0].clientX };
        }}
        onTouchMove={(event) => {
          const dx = swipeRef.current.x - event.touches[0].clientX;
          if (dx > 8) setSwipe(Math.min(dx, 144));
          if (dx < -8) setSwipe(0);
        }}
        onTouchEnd={() => {
          setSwipe((value) => (value > 56 ? 144 : 0));
        }}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'lh-chat-list-row relative z-[1] flex w-full min-h-[4.25rem] items-center gap-3 bg-card px-3.5 py-3 text-left',
          active ? 'bg-brand-soft' : 'hover:bg-muted/50',
        )}
        style={{ transform: swipe ? `translateX(-${swipe}px)` : undefined }}
      >
        <ChatAvatar
          title={title}
          kind={chat.kind}
          user={peerUser || (peerId ? { id: peerId } : null)}
          online={online}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-foreground">
              {title}
            </span>
            {pinned ? <Pin className={cn(iconSize.sm, 'shrink-0 text-brand')} aria-hidden /> : null}
            {muted ? <VolumeX className={cn(iconSize.sm, 'shrink-0 text-muted-foreground')} aria-hidden /> : null}
            {favorite ? <Star className={cn(iconSize.sm, 'shrink-0 text-brand-gold')} aria-hidden /> : null}
            <time className="shrink-0 text-[11px] text-muted-foreground md:group-hover:opacity-0">
              {time}
            </time>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            {Icon ? <Icon className={cn(iconSize.sm, 'shrink-0 text-muted-foreground')} aria-hidden /> : null}
            {typing ? (
              <ChatTypingDots label="печатает…" />
            ) : (
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[13px]',
                  draft ? 'italic text-brand' : unreadCount > 0 ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {subtitle || 'Нет сообщений'}
              </span>
            )}
            {unreadCount > 0 ? (
              <Badge
                tone={muted ? 'neutral' : 'default'}
                className={cn(
                  'min-w-5 justify-center px-1.5 text-[10px]',
                  !muted && 'bg-brand text-white hover:bg-brand',
                )}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            ) : null}
          </span>
        </span>
      </button>
    </div>
  );
});

export default function ChatSidebar({
  groups = {},
  activeChatId,
  onSelect,
  onFindInterlocutor,
  onOpenRequests,
  currentUserId,
  pendingRequestsCount = 0,
  previewByChat = {},
  typingByChat = {},
  onToggleMemberPref,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && query) setQuery('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [query]);

  const chats = useMemo(() => {
    const all = Object.values(groups || {}).flat();
    const q = query.trim().toLowerCase();
    let rows = all.filter((chat) => {
      const archived = isChatArchived(chat);
      if (filter === 'archive') return archived;
      if (archived) return false;
      if (filter === 'unread') return (chat.unreadCount || 0) > 0;
      if (filter === 'favorites') return isChatFavorite(chat);
      return true;
    });
    if (q) {
      rows = rows.filter((chat) => {
        const title = resolveChatTitle(chat, { currentUserId }).toLowerCase();
        const preview = String(previewByChat[chat.id]?.text || '').toLowerCase();
        return title.includes(q) || preview.includes(q);
      });
    }
    return sortChatsForList(rows, previewByChat);
  }, [groups, query, filter, previewByChat, currentUserId]);

  const menuChat = menu?.chat;

  const runPref = (chat, key) => {
    if (!chat?.id || !onToggleMemberPref) return;
    void onToggleMemberPref(chat, key);
  };

  return (
    <div className="lh-chat-sidebar flex h-full min-h-0 flex-col border-r border-border/60 bg-card">
      <div className="space-y-2.5 px-3.5 pb-3 pt-3.5 safe-pt lg:pt-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Чаты</h1>
          <IconButton type="button" label="Новый чат" onClick={onFindInterlocutor}>
            <PenSquare />
          </IconButton>
        </div>
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск"
          aria-label="Поиск по чатам"
        />
        <div
          className="lh-chat-filter-tabs"
          role="tablist"
          aria-label="Фильтры чатов"
        >
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              intent={filter === item.id ? 'primary' : 'ghost'}
              className="lh-chat-filter-tabs__btn"
              onClick={() => setFilter(item.id)}
              aria-selected={filter === item.id}
              role="tab"
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Button type="button" intent="ghost" size="sm" className="w-full justify-start" onClick={onOpenRequests}>
          Запросы
          {pendingRequestsCount > 0 ? (
            <Badge className="ml-auto bg-brand text-white">{pendingRequestsCount}</Badge>
          ) : null}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-0" role="list" aria-label="Список чатов">
        {chats.length ? (
          chats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              active={chat.id === activeChatId}
              currentUserId={currentUserId}
              preview={previewByChat[chat.id]}
              typing={Boolean((typingByChat[chat.id] || []).length)}
              onSelect={onSelect}
              onMenu={setMenu}
              onMute={(row) => runPref(row, 'mute')}
              onArchive={(row) => runPref(row, 'archive')}
            />
          ))
        ) : (
          <EmptyState
            className="lh-chat-empty"
            preset="messages"
            icon={PenSquare}
            title={filter === 'archive' ? 'Архив пуст' : 'Нет чатов'}
            description={
              filter === 'archive'
                ? 'Переместите чат в архив через меню или свайп.'
                : 'Найдите собеседника — диалог откроется как в мессенджере.'
            }
            actionLabel={filter === 'archive' ? undefined : 'Новый чат'}
            onAction={filter === 'archive' ? undefined : onFindInterlocutor}
          />
        )}
      </div>
      {menuChat ? (
        <ChatListMenu
          x={menu.x}
          y={menu.y}
          pinned={isChatPinned(menuChat)}
          muted={isChatMuted(menuChat)}
          favorite={isChatFavorite(menuChat)}
          archived={isChatArchived(menuChat)}
          onClose={() => setMenu(null)}
          onAction={(id) => {
            runPref(menuChat, id);
            setMenu(null);
          }}
        />
      ) : null}
    </div>
  );
}
