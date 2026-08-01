import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ClipboardCheck,
  ExternalLink,
  NotebookPen,
  Users,
  MessageCircle,
  Info,
  Loader2,
  Send,
} from 'lucide-react';
import { api } from '@/api';
import { chatsApi } from '@/api/chats.api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { localizeAttendanceStatus } from '@/lib/locale-by';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import {
  connectChatSocket,
  joinChat,
  leaveChat,
  subscribeToChatSocket,
} from '@/lib/chat-socket';
import { normalizeMessage } from '@/lib/chat-normalize';
import {
  formatJoinedAt,
  mergeRosterWithPresence,
  shouldSuggestPresent,
} from '@/lib/lesson-video';
import { openMaterial } from '@/lib/materialUrl';

/** Order matches product UX: chat first, then study tools, then roster. */
const BASE_TABS = [
  { id: 'chat', label: 'Чат', icon: MessageCircle },
  { id: 'materials', label: 'Материалы', icon: BookOpen },
  { id: 'homework', label: 'ДЗ', icon: NotebookPen },
  { id: 'participants', label: 'Участники', icon: Users },
  { id: 'info', label: 'Инфо', icon: Info },
];

const ATTENDANCE_TAB = {
  id: 'attendance',
  label: 'Посещаемость',
  icon: ClipboardCheck,
};

function messageBody(row) {
  return row?.body || row?.text || row?.content || '';
}

function roleLabel(role) {
  if (role === 'teacher') return 'преподаватель';
  if (role === 'tutor') return 'репетитор';
  if (role === 'student') return 'ученик';
  if (role === 'guest') return 'гость';
  return role || 'участник';
}

function attendanceActionLabel(status) {
  if (status === 'attended') return 'Был';
  if (status === 'missed') return 'Не был';
  if (status === 'late') return 'Опоздал';
  if (status === 'excused') return 'Уважительная причина';
  return localizeAttendanceStatus(status);
}

/** Open CRM pages without leaving / disposing the live Jitsi stage. */
function openCrmInNewTab(path) {
  if (!path) return;
  const url = path.startsWith('http') ? path : path;
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    toast({
      title: 'Разрешите всплывающие окна',
      description: 'Каталог откроется в новой вкладке, чтобы видеоурок не прерывался.',
      variant: 'destructive',
    });
  }
}

function upsertLessonMessage(list, message) {
  const rows = Array.isArray(list) ? [...list] : [];
  const idx = rows.findIndex((row) => row.id === message.id);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...message };
    return rows;
  }
  return [...rows, message];
}

export default function LessonVideoSideRail({
  lessonId,
  lesson,
  isHost,
  isStudent,
  canManageAttendance = false,
  materialsPath,
  homeworkPath,
  compact = false,
  jitsiParticipantCount = null,
  livePresence = [],
  timeRange = '',
  subject = '',
  connectionLabel = '',
  activeTab,
  onActiveTabChange,
  onChatUnreadChange,
}) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const tabs = useMemo(() => {
    if (!canManageAttendance) return BASE_TABS;
    const next = [...BASE_TABS];
    const participantsIdx = next.findIndex((t) => t.id === 'participants');
    next.splice(participantsIdx + 1, 0, ATTENDANCE_TAB);
    return next;
  }, [canManageAttendance]);

  const [internalTab, setInternalTab] = useState(activeTab || 'chat');
  const tab = activeTab ?? internalTab;
  const setTab = (next) => {
    if (onActiveTabChange) onActiveTabChange(next);
    else setInternalTab(next);
  };

  const tabRef = useRef(tab);
  const [participants, setParticipants] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [homework, setHomework] = useState([]);
  const [loadingHw, setLoadingHw] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [openingMaterialId, setOpeningMaterialId] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    if (typeof activeTab === 'string' && activeTab !== internalTab) {
      setInternalTab(activeTab);
    }
  }, [activeTab, internalTab]);

  useEffect(() => {
    onChatUnreadChange?.(chatUnread);
  }, [chatUnread, onChatUnreadChange]);

  useEffect(() => {
    if (!canManageAttendance && tab === 'attendance') {
      setTab('chat');
    }
  }, [canManageAttendance, tab]);

  useEffect(() => {
    if (tab !== 'attendance' && tab !== 'participants') return undefined;
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [tab]);

  const loadParticipants = useCallback(async () => {
    if (!lessonId) return;
    setLoadingPeople(true);
    try {
      const res = await api.video.getParticipants(lessonId);
      setParticipants(res.participants || res.Participants || []);
    } catch (err) {
      toast({
        title: 'Не удалось загрузить участников',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setLoadingPeople(false);
    }
  }, [lessonId]);

  const loadHomework = useCallback(async () => {
    if (!lessonId) return;
    setLoadingHw(true);
    try {
      const list = isStudent
        ? await api.homework.listMyAssignments()
        : await api.homework.list();
      const rows = Array.isArray(list) ? list : list?.items || list?.data || [];
      const filtered = rows.filter((row) => {
        const lid = row.lesson_id || row.lessonId || row.lesson?.id;
        return lid === lessonId;
      });
      setHomework(filtered.slice(0, 20));
    } catch {
      setHomework([]);
    } finally {
      setLoadingHw(false);
    }
  }, [lessonId, isStudent]);

  const loadMaterials = useCallback(async () => {
    setLoadingMaterials(true);
    try {
      const list = await api.materials.list('-created_date', 40);
      const rows = Array.isArray(list) ? list : [];
      setMaterials(rows.filter((row) => row?.status !== 'deleted').slice(0, 30));
    } catch {
      setMaterials([]);
      toast({
        title: 'Не удалось загрузить материалы',
        description: 'Попробуйте ещё раз. Видеозвонок продолжается.',
        variant: 'destructive',
      });
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  const handleOpenMaterial = useCallback(async (material) => {
    if (!material?.id) return;
    setOpeningMaterialId(material.id);
    try {
      await openMaterial(material);
    } catch (err) {
      toast({
        title: 'Не удалось открыть материал',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setOpeningMaterialId(null);
    }
  }, []);

  const loadChatMessages = useCallback(async (id) => {
    if (!id) return;
    setLoadingChat(true);
    try {
      const msgs = await chatsApi.messages(id, { limit: 50 });
      const rows = Array.isArray(msgs) ? msgs : msgs?.items || msgs?.messages || [];
      setMessages([...rows].reverse());
    } catch (err) {
      toast({
        title: 'Не удалось загрузить чат урока',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setLoadingChat(false);
    }
  }, []);

  useEffect(() => {
    if (!lessonId) return undefined;
    let cancelled = false;
    connectChatSocket();
    (async () => {
      try {
        const chat = await api.video.ensureLessonChat(lessonId);
        if (cancelled) return;
        const id = chat.id || chat.chat_id;
        setChatId(id);
      } catch {
        // Chat tab will surface the error when opened.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  useEffect(() => {
    if (!chatId) return undefined;
    joinChat(chatId);
    return () => leaveChat(chatId);
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return undefined;
    return subscribeToChatSocket({
      'message.created': (raw) => {
        const next = normalizeMessage(raw);
        if (!next?.chatId || next.chatId !== chatId) return;
        setMessages((prev) => upsertLessonMessage(prev, next));
        const mine = next.senderUserId && next.senderUserId === user?.id;
        if (!mine && tabRef.current !== 'chat') {
          setChatUnread((n) => n + 1);
        }
      },
    });
  }, [chatId, user?.id]);

  useEffect(() => {
    if (tab === 'participants' || tab === 'attendance') void loadParticipants();
    if (tab === 'homework') void loadHomework();
    if (tab === 'materials') void loadMaterials();
    if (tab === 'chat' && chatId) {
      void loadChatMessages(chatId);
      setChatUnread(0);
      void chatsApi.markRead(chatId).catch(() => {});
    }
  }, [tab, loadParticipants, loadHomework, loadMaterials, loadChatMessages, chatId]);

  const rosterWithPresence = useMemo(
    () => mergeRosterWithPresence(participants, livePresence),
    [participants, livePresence],
  );

  const attendanceRows = useMemo(
    () =>
      rosterWithPresence.filter(
        (p) => p.role === 'student' && (p.attendance_id || p.student_id),
      ),
    [rosterWithPresence],
  );

  const sendChat = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      let id = chatId;
      if (!id) {
        const chat = await api.video.ensureLessonChat(lessonId);
        id = chat.id || chat.chat_id;
        setChatId(id);
      }
      if (!id) {
        toast({
          title: 'Чат урока недоступен',
          description: 'Не удалось открыть чат этого урока',
          variant: 'destructive',
        });
        return;
      }
      await chatsApi.sendMessage(id, { body: text });
      setDraft('');
      await loadChatMessages(id);
      setChatUnread(0);
      void chatsApi.markRead(id).catch(() => {});
    } catch (err) {
      toast({
        title: 'Не удалось отправить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const setAttendanceStatus = async (attendanceId, status) => {
    if (!attendanceId || !status) return;
    setStatusBusy(true);
    try {
      if (status === 'attended') {
        await api.lessons.attendance.present(attendanceId);
      } else if (status === 'missed') {
        await api.lessons.attendance.absent(attendanceId);
      } else if (status === 'late') {
        await api.lessons.attendance.late(attendanceId);
      } else if (status === 'excused') {
        await api.lessons.attendance.excused(attendanceId);
      } else {
        await api.lessons.attendance.update(attendanceId, {
          attendanceStatus: status,
        });
      }
      await loadParticipants();
      toast({ title: `Посещаемость: ${attendanceActionLabel(status)}` });
    } catch (err) {
      toast({
        title: 'Не удалось обновить посещаемость',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setStatusBusy(false);
    }
  };

  const completeLesson = async () => {
    if (!lessonId) return;
    setStatusBusy(true);
    try {
      await api.lessons.update(lessonId, { status: 'completed' });
      toast({ title: 'Урок отмечен завершённым' });
    } catch (err) {
      toast({
        title: 'Не удалось сменить статус',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setStatusBusy(false);
    }
  };

  const muted = isDark ? 'text-slate-400' : 'text-muted-foreground';
  const soft = isDark ? 'text-slate-500' : 'text-muted-foreground';
  const panel = isDark
    ? 'border-white/10 bg-white/[0.03]'
    : 'border-border bg-muted/40';
  const inputCls = isDark
    ? 'border-white/10 bg-neutral-900 text-slate-100 placeholder:text-slate-500'
    : 'border-border bg-background text-foreground placeholder:text-muted-foreground';

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden',
        compact ? '' : '',
        isDark ? 'bg-neutral-950 text-slate-100' : 'bg-card text-foreground',
      )}
      data-testid="lesson-video-side-rail"
    >
      <div
        className={cn(
          'flex shrink-0 gap-1 overflow-x-auto border-b p-2 scrollbar-none',
          isDark ? 'border-white/10' : 'border-border',
        )}
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors sm:h-10 sm:px-3 sm:text-xs',
              tab === id
                ? 'bg-brand/15 text-brand'
                : muted + (isDark ? ' hover:bg-white/5 hover:text-slate-100' : ' hover:bg-muted hover:text-foreground'),
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="whitespace-nowrap">{label}</span>
            {id === 'chat' && chatUnread > 0 ? (
              <span
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white"
                data-testid="lesson-video-chat-unread"
              >
                {chatUnread > 99 ? '99+' : chatUnread}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 text-sm">
        {tab === 'materials' && (
          <div className="space-y-3" data-testid="lesson-video-materials">
            <p className={cn('text-xs leading-relaxed', muted)}>
              Материалы открываются в новой вкладке. Видеозвонок на этой странице не
              прерывается.
            </p>
            {loadingMaterials ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            ) : materials.length ? (
              <ul className="space-y-2">
                {materials.map((mat) => (
                  <li
                    key={mat.id}
                    className={cn('rounded-xl border p-3', panel)}
                  >
                    <p className="truncate text-xs font-medium">
                      {mat.title || 'Материал'}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 w-full min-h-11"
                      disabled={openingMaterialId === mat.id}
                      onClick={() => void handleOpenMaterial(mat)}
                    >
                      {openingMaterialId === mat.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Открытие…
                        </>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Открыть
                        </>
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn('text-xs', soft)}>Пока нет доступных материалов.</p>
            )}
            {lesson?.notes ? (
              <div className={cn('rounded-xl border p-3 text-xs whitespace-pre-wrap', panel, muted)}>
                {lesson.notes}
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-11"
              onClick={() => openCrmInNewTab(materialsPath)}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Полный каталог материалов
            </Button>
          </div>
        )}

        {tab === 'homework' && (
          <div className="space-y-3">
            {loadingHw ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            ) : homework.length ? (
              <ul className="space-y-2">
                {homework.map((row) => (
                  <li
                    key={row.id || row.assignment_id}
                    className={cn('rounded-xl border p-3', panel)}
                  >
                    <p className="truncate text-xs font-medium">
                      {row.title || row.homework?.title || 'Домашнее задание'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn('text-xs', soft)}>Нет ДЗ, привязанных к этому уроку.</p>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-11"
              onClick={() => openCrmInNewTab(homeworkPath)}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {isHost ? 'Назначить / список ДЗ' : 'Мои задания'}
            </Button>
          </div>
        )}

        {tab === 'participants' && (
          <div className="space-y-3" data-testid="lesson-video-participants">
            <div className={cn('flex items-center justify-between text-xs', muted)}>
              <span>В уроке: {participants.length}</span>
              {typeof jitsiParticipantCount === 'number' ? (
                <span>В видео: {jitsiParticipantCount}</span>
              ) : null}
            </div>
            {loadingPeople ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            ) : (
              <ul className="space-y-2">
                {rosterWithPresence.map((p, idx) => (
                  <li
                    key={`${p.role}-${p.student_id || p.presence?.id || p.name}-${idx}`}
                    className={cn('rounded-xl border p-3', panel)}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className={cn(
                          'mt-1 h-2 w-2 shrink-0 rounded-full',
                          p.online ? 'bg-emerald-500' : isDark ? 'bg-slate-600' : 'bg-muted-foreground/40',
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-xs font-medium">{p.name}</p>
                        <p className={cn('text-[11px]', soft)}>
                          {roleLabel(p.role)}
                          {' · '}
                          {p.online ? 'онлайн' : 'офлайн'}
                        </p>
                        <p className={cn('text-[11px]', soft)}>
                          {formatJoinedAt(p.joinedAt)}
                          {' · '}
                          {p.connectionStatus}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'attendance' && canManageAttendance && (
          <div className="space-y-3" data-testid="lesson-video-attendance">
            <p className={cn('text-[11px] leading-relaxed', soft)}>
              Отметьте посещаемость вручную. Если ученик был в конференции достаточно долго,
              система предложит статус «Был».
            </p>
            {loadingPeople ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            ) : attendanceRows.length ? (
              <ul className="space-y-3">
                {attendanceRows.map((p, idx) => {
                  const status = p.attendance_status || 'enrolled';
                  const suggestPresent =
                    status === 'enrolled' &&
                    shouldSuggestPresent(p.presence, undefined, nowTick);
                  return (
                    <li
                      key={`${p.attendance_id || p.student_id}-${idx}`}
                      className={cn('space-y-2 rounded-xl border p-3', panel)}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{p.name}</p>
                        <p className={cn('text-[11px]', soft)}>
                          {p.connectionStatus}
                          {' · '}
                          {localizeAttendanceStatus(status)}
                        </p>
                        {suggestPresent ? (
                          <p
                            className="mt-1 text-[11px] text-emerald-500"
                            data-testid="attendance-suggest-present"
                          >
                            Рекомендуем: Был
                          </p>
                        ) : null}
                      </div>
                      {p.attendance_id ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { status: 'attended', label: 'Был', suggest: suggestPresent },
                            { status: 'missed', label: 'Не был' },
                            { status: 'late', label: 'Опоздал' },
                            { status: 'excused', label: 'Уважительная причина' },
                          ].map((btn) => {
                            const active = status === btn.status;
                            return (
                              <Button
                                key={btn.status}
                                type="button"
                                size="sm"
                                variant={active ? 'default' : 'outline'}
                                disabled={statusBusy}
                                className={cn(
                                  'min-h-10 px-2 text-[11px] leading-tight',
                                  btn.suggest && !active && 'ring-1 ring-emerald-500/40',
                                )}
                                onClick={() =>
                                  void setAttendanceStatus(p.attendance_id, btn.status)
                                }
                              >
                                {btn.label}
                              </Button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400/90">
                          Нет записи посещаемости
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={cn('text-xs', soft)}>Нет учеников для отметки посещаемости.</p>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex h-full min-h-[220px] flex-col gap-2">
            {loadingChat && !messages.length ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            ) : (
              <div
                className={cn(
                  'min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border p-2',
                  panel,
                )}
              >
                {messages.length ? (
                  messages.map((m) => (
                    <div key={m.id} className="text-xs leading-relaxed">
                      <span className="font-medium text-brand">
                        {m.sender_name || m.senderName || m.senderUser?.firstName || 'Участник'}
                        :{' '}
                      </span>
                      <span className={isDark ? 'text-slate-200' : 'text-foreground'}>
                        {messageBody(m)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className={cn('text-xs', soft)}>Сообщений пока нет</p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className={cn('min-h-11 flex-1 rounded-xl border px-3 text-sm', inputCls)}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Сообщение урока…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void sendChat();
                  }
                }}
              />
              <Button
                type="button"
                className="min-h-11 min-w-11"
                disabled={sending || !draft.trim()}
                onClick={() => void sendChat()}
                aria-label="Отправить"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {tab === 'info' && (
          <div className={cn('space-y-3 text-xs', isDark ? 'text-slate-300' : 'text-foreground')}>
            <div className={cn('space-y-1.5 rounded-xl border p-3', panel)}>
              <p>
                <span className={soft}>Урок:</span>{' '}
                <span className="font-medium">{lesson?.title || 'Онлайн-урок'}</span>
              </p>
              <p>
                <span className={soft}>Предмет:</span> {subject || '—'}
              </p>
              <p>
                <span className={soft}>Преподаватель:</span> {lesson?.teacher_name || '—'}
              </p>
              <p>
                <span className={soft}>Время:</span> {timeRange || '—'}
              </p>
              {connectionLabel ? (
                <p>
                  <span className={soft}>Статус:</span> {connectionLabel}
                </p>
              ) : null}
              {lesson?.group_name ? (
                <p>
                  <span className={soft}>Группа:</span> {lesson.group_name}
                </p>
              ) : null}
            </div>
            {isHost ? (
              <div className="space-y-2">
                <p className={soft}>Действия преподавателя</p>
                <Button
                  type="button"
                  className="w-full min-h-11"
                  disabled={statusBusy}
                  onClick={() => void completeLesson()}
                >
                  Отметить урок завершённым
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-11"
                  onClick={() => openCrmInNewTab(homeworkPath)}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Назначить домашнее задание
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full min-h-11"
                  onClick={() => openCrmInNewTab(createPageUrl('TeacherSchedule'))}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  К расписанию
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
