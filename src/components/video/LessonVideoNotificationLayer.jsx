import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Hand, MessageCircle, X, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/design-system';
import {
  VIDEO_NOTIF_KINDS,
  VIDEO_NOTIF_TOAST_TTL_MS,
  buildVideoNotifEvent,
  claimVideoNotifKey,
  releaseVideoNotifKey,
  handRaiseDedupeKey,
  chatMessageDedupeKey,
  pingDedupeKey,
  pushToastStack,
  dismissToastFromStack,
  pushCenterList,
  markCenterRead,
  markAllCenterRead,
  unreadCenterCount,
  kindIconLabel,
  resolveVideoNotifChannels,
  showVideoOsNotification,
  ensureVideoNotifPermission,
  wasVideoNotifPromptDismissed,
  dismissVideoNotifPrompt,
  clearVideoNotifDedupe,
} from '@/lib/video-call-notifications';

function KindGlyph({ kind }) {
  if (kind === VIDEO_NOTIF_KINDS.HAND) {
    return <Hand className="h-4 w-4" aria-hidden />;
  }
  if (kind === VIDEO_NOTIF_KINDS.CHAT) {
    return <MessageCircle className="h-4 w-4" aria-hidden />;
  }
  return <BellRing className="h-4 w-4" aria-hidden />;
}

function kindTone(kind) {
  if (kind === VIDEO_NOTIF_KINDS.HAND) {
    return 'bg-amber-500/15 text-amber-900 dark:text-amber-100';
  }
  if (kind === VIDEO_NOTIF_KINDS.CHAT) {
    return 'bg-brand/15 text-brand';
  }
  if (kind === VIDEO_NOTIF_KINDS.PING) {
    return 'bg-sky-500/15 text-sky-900 dark:text-sky-100';
  }
  return 'bg-rose-500/15 text-rose-800 dark:text-rose-200';
}

/**
 * Teacher-facing in-call notification layer: toast stack + center + OS notify.
 *
 * Layout (top of stage):
 *   [ toast stack ]
 *   [ persistentSlot — usually screen-share bar ]
 *
 * Bell / permission stay top-right and do not compete with the share bar.
 * Toasts and persistentSlot share one flex column so the share control
 * reflows (slides) when notifications appear or dismiss — no overlap.
 */
export default function LessonVideoNotificationLayer({
  enabled = false,
  lessonId = null,
  screenSharing = false,
  chatPanelOpen = false,
  participantsOpen = false,
  livePresence = [],
  localCrmUserId = null,
  /** Incoming chat toast payload from LessonVideoSideRail */
  chatToast = null,
  onConsumeChatToast,
  onOpenChat,
  onOpenParticipants,
  onPinParticipant,
  /** Persistent chrome rendered AFTER toast stack (e.g. screen-share bar). */
  persistentSlot = null,
}) {
  const [toasts, setToasts] = useState([]);
  const [center, setCenter] = useState([]);
  const [centerOpen, setCenterOpen] = useState(false);
  const [permission, setPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );
  const [showPermPrompt, setShowPermPrompt] = useState(false);
  const handStateRef = useRef(new Map());
  const timersRef = useRef(new Map());

  useEffect(() => {
    if (!enabled) {
      clearVideoNotifDedupe();
      setToasts([]);
      setCenter([]);
      setCenterOpen(false);
      handStateRef.current = new Map();
      return undefined;
    }
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
      if (
        Notification.permission === 'default' &&
        !wasVideoNotifPromptDismissed()
      ) {
        setShowPermPrompt(true);
      }
    }
    return () => {
      for (const t of timersRef.current.values()) window.clearTimeout(t);
      timersRef.current.clear();
    };
  }, [enabled]);

  const viewingCtx = useCallback(
    (action) => {
      const hidden =
        typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false;
      const focused =
        typeof document !== 'undefined' ? Boolean(document.hasFocus?.()) : true;
      let viewingTarget = false;
      if (action === 'open_chat' && chatPanelOpen && !hidden && focused) {
        viewingTarget = true;
      }
      if (action === 'open_participants' && participantsOpen && !hidden && focused) {
        viewingTarget = true;
      }
      return {
        documentHidden: hidden,
        documentFocused: focused,
        screenSharing: Boolean(screenSharing),
        viewingTarget,
        permission,
      };
    },
    [chatPanelOpen, participantsOpen, screenSharing, permission],
  );

  const handleAction = useCallback(
    (event) => {
      if (!event) return;
      setCenter((prev) => markCenterRead(prev, event.id));
      setToasts((prev) => dismissToastFromStack(prev, event.id));
      if (event.action === 'open_chat') {
        onOpenChat?.();
        return;
      }
      if (event.action === 'open_participants') {
        onOpenParticipants?.();
        if (event.participantId) {
          onPinParticipant?.(event.participantId, event.actorName);
        }
      }
    },
    [onOpenChat, onOpenParticipants, onPinParticipant],
  );

  const ingest = useCallback(
    (partial) => {
      if (!enabled) return null;
      const event = buildVideoNotifEvent({
        ...partial,
        lessonId: partial.lessonId || lessonId,
      });
      if (!event) return null;
      if (!claimVideoNotifKey(event.dedupeKey)) return null;

      setCenter((prev) => pushCenterList(prev, event));
      const channels = resolveVideoNotifChannels(viewingCtx(event.action));
      if (channels.toast) {
        setToasts((prev) => pushToastStack(prev, event));
        const existing = timersRef.current.get(event.id);
        if (existing) window.clearTimeout(existing);
        timersRef.current.set(
          event.id,
          window.setTimeout(() => {
            setToasts((prev) => dismissToastFromStack(prev, event.id));
            timersRef.current.delete(event.id);
          }, VIDEO_NOTIF_TOAST_TTL_MS),
        );
      }
      if (channels.os) {
        void showVideoOsNotification(event, {
          onClick: (ev) => handleAction(ev),
        });
      }
      return event;
    },
    [enabled, lessonId, viewingCtx, handleAction],
  );

  // Raise-hand: false → true only (existing Jitsi presence).
  useEffect(() => {
    if (!enabled) return;
    const nextMap = new Map();
    for (const row of livePresence || []) {
      if (!row?.online) continue;
      const identity =
        row.crmUserId ||
        row.email ||
        row.id ||
        null;
      if (!identity) continue;
      if (localCrmUserId && row.crmUserId && row.crmUserId === localCrmUserId) {
        continue;
      }
      const raised = Boolean(row.handRaised);
      nextMap.set(identity, { raised, row });
      const prev = handStateRef.current.get(identity);
      const dedupeKey = handRaiseDedupeKey(lessonId, identity);
      if (raised && !prev?.raised) {
        const name = row.displayName || 'Ученик';
        ingest({
          kind: VIDEO_NOTIF_KINDS.HAND,
          id: `${dedupeKey}:${Date.now()}`,
          dedupeKey,
          title: name,
          body: 'Поднял(а) руку',
          actorName: name,
          actorId: identity,
          participantId: row.id,
          action: 'open_participants',
          actionHint: 'Нажмите, чтобы посмотреть',
        });
      } else if (!raised && prev?.raised) {
        releaseVideoNotifKey(dedupeKey);
      }
    }
    handStateRef.current = nextMap;
  }, [enabled, livePresence, lessonId, localCrmUserId, ingest]);

  // Chat toast from SideRail → unified layer.
  useEffect(() => {
    if (!enabled || !chatToast) return;
    const sender =
      chatToast.senderName || chatToast.sender || 'Участник';
    const messageId =
      chatToast.messageId ||
      chatToast.id ||
      `${Date.now()}-${sender}`;
    const dedupeKey = chatMessageDedupeKey(lessonId, messageId);
    ingest({
      kind: VIDEO_NOTIF_KINDS.CHAT,
      id: dedupeKey,
      dedupeKey,
      title: 'Новое сообщение',
      body: `${sender}${chatToast.body ? `: ${String(chatToast.body).slice(0, 80)}` : ' отправил(а) сообщение'}`,
      actorName: sender,
      actorId: chatToast.senderUserId || sender,
      messageId,
      action: 'open_chat',
      actionHint: 'Нажмите, чтобы открыть чат',
    });
    onConsumeChatToast?.();
  }, [enabled, chatToast, lessonId, ingest, onConsumeChatToast]);

  const notifyPing = useCallback(
    ({ displayName, crmUserId, participantId } = {}) => {
      if (!enabled) return;
      const identity = crmUserId || participantId || displayName || 'unknown';
      const dedupeKey = pingDedupeKey(lessonId, identity);
      const name = displayName || 'Ученик';
      ingest({
        kind: VIDEO_NOTIF_KINDS.PING,
        id: `${dedupeKey}:${Date.now()}`,
        dedupeKey,
        title: name,
        body: 'Отправил(а) запрос внимания',
        actorName: name,
        actorId: identity,
        participantId: participantId || null,
        action: 'open_participants',
        actionHint: 'Нажмите, чтобы посмотреть',
      });
    },
    [enabled, lessonId, ingest],
  );

  // Expose ping ingest to parent via custom event on window for embed bridge
  // (parent passes callback ref through useImperative-less pattern).
  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      notifyPing(e.detail || {});
    };
    window.addEventListener('lh-video-ping', handler);
    return () => window.removeEventListener('lh-video-ping', handler);
  }, [enabled, notifyPing]);

  const unread = useMemo(() => unreadCenterCount(center), [center]);

  const requestPermission = useCallback(async () => {
    const next = await ensureVideoNotifPermission();
    setPermission(next);
    setShowPermPrompt(false);
    dismissVideoNotifPrompt();
  }, []);

  if (!enabled) {
    return persistentSlot ? (
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[45] flex justify-center px-2 pt-2"
        data-testid="lesson-video-notif-layer-persistent-only"
      >
        {persistentSlot}
      </div>
    ) : null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[45] overflow-x-hidden"
      data-testid="lesson-video-notif-layer"
      aria-live="polite"
    >
      {/* Bell + permission — top-right, independent of share stack. */}
      <div className="pointer-events-none absolute right-2 top-2 z-20 flex max-w-[min(100%-1rem,18rem)] flex-col items-end gap-2 sm:right-3 sm:top-3">
        {showPermPrompt && permission === 'default' ? (
          <div
            className="pointer-events-auto w-full rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md"
            data-testid="lesson-video-notif-permission"
          >
            <p className="text-sm font-semibold text-foreground">
              Уведомления во время урока
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Чтобы не пропустить поднятую руку или сообщение, пока идёт демонстрация
              экрана, разрешите системные уведомления.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                intent="primary"
                className="min-h-10"
                onClick={() => void requestPermission()}
                data-testid="lesson-video-notif-permission-allow"
              >
                Разрешить
              </Button>
              <Button
                type="button"
                size="sm"
                intent="outline"
                className="min-h-10"
                onClick={() => {
                  setShowPermPrompt(false);
                  dismissVideoNotifPrompt();
                }}
              >
                Не сейчас
              </Button>
            </div>
          </div>
        ) : null}

        {permission === 'denied' ? (
          <div
            className="pointer-events-auto max-w-full rounded-xl border border-border bg-card/95 px-3 py-2 text-[11px] text-muted-foreground shadow-md"
            data-testid="lesson-video-notif-denied-hint"
          >
            Уведомления заблокированы в браузере / macOS. Включите их для
            lk.longhuachinese.online в настройках системы.
          </div>
        ) : null}

        <div className="pointer-events-auto relative">
          <button
            type="button"
            className={cn(
              'inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-border bg-card/95 px-2.5 text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-accent',
              centerOpen && 'ring-2 ring-brand/40',
            )}
            aria-label={
              unread > 0
                ? `Уведомления урока, непрочитанных: ${unread}`
                : 'Уведомления урока'
            }
            title="Уведомления урока"
            data-testid="lesson-video-notif-bell"
            onClick={() => setCenterOpen((v) => !v)}
          >
            <Bell className="h-4 w-4" aria-hidden />
            {unread > 0 ? (
              <Badge
                tone="danger"
                className="h-5 min-w-5 px-1 text-[10px]"
                data-testid="lesson-video-notif-badge"
              >
                {unread > 9 ? '9+' : unread}
              </Badge>
            ) : null}
          </button>

          {centerOpen ? (
            <div
              className="absolute right-0 top-12 z-50 w-[min(100vw-1.5rem,20rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
              data-testid="lesson-video-notif-center"
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-semibold text-foreground">
                  События урока
                </span>
                <div className="flex items-center gap-1">
                  {unread > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      intent="ghost"
                      className="h-8 text-xs"
                      onClick={() => setCenter((prev) => markAllCenterRead(prev))}
                    >
                      Прочитать все
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                    aria-label="Закрыть"
                    onClick={() => setCenterOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <ul className="max-h-72 overflow-y-auto p-1.5">
                {center.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Пока нет событий
                  </li>
                ) : (
                  center.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/80',
                          !row.read && 'bg-muted/40',
                        )}
                        onClick={() => {
                          handleAction(row);
                          setCenterOpen(false);
                        }}
                      >
                        <span
                          className={cn(
                            'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                            kindTone(row.kind),
                          )}
                        >
                          <KindGlyph kind={row.kind} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-foreground">
                            {kindIconLabel(row.kind)}{' '}
                            {row.actorName || row.title}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                            {row.body}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/*
        Single vertical stack: notifications then persistent screen-share control.
        Flex gap reflows the share bar when toasts mount/unmount — no overlap.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-2 z-10 flex max-h-[min(42vh,22rem)] flex-col items-center overflow-x-hidden overflow-y-auto px-2 sm:top-3 sm:px-3"
        data-testid="lesson-video-top-stack"
      >
        <div
          className={cn(
            'flex w-full max-w-[min(100%,26rem)] flex-col items-stretch gap-2',
            'transition-[gap] duration-200 ease-out',
          )}
        >
          <div
            className="flex flex-col gap-2"
            data-testid="lesson-video-notif-toasts"
          >
            {toasts.map((row) => (
              <div
                key={row.id}
                className="pointer-events-auto animate-in fade-in-0 slide-in-from-top-2 duration-200"
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-2.5 rounded-2xl border border-border bg-card/95 p-3 text-left shadow-xl backdrop-blur-md"
                  data-testid={`lesson-video-notif-toast-${row.kind}`}
                  onClick={() => handleAction(row)}
                >
                  <span
                    className={cn(
                      'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      kindTone(row.kind),
                    )}
                  >
                    <KindGlyph kind={row.kind} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {kindIconLabel(row.kind)} {row.actorName || row.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {row.body}
                    </span>
                    <span className="mt-1 block text-[10px] font-medium text-brand">
                      {row.actionHint}
                    </span>
                  </span>
                  <span
                    role="presentation"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      setToasts((prev) => dismissToastFromStack(prev, row.id));
                    }}
                  >
                    <X className="h-4 w-4" />
                  </span>
                </button>
              </div>
            ))}
          </div>

          {persistentSlot ? (
            <div
              className="w-full transition-all duration-200 ease-out"
              data-testid="lesson-video-top-stack-persistent"
            >
              {persistentSlot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
