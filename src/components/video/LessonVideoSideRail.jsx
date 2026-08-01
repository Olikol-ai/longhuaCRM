import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ClipboardCheck,
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
import {
  connectChatSocket,
  joinChat,
  leaveChat,
  subscribeToChatSocket,
} from '@/lib/chat-socket';
import { normalizeMessage } from '@/lib/chat-normalize';
import {
  findLivePresence,
  formatJoinedAt,
  participantConnectionLabel,
  shouldSuggestPresent,
} from '@/lib/lesson-video';

const BASE_TABS = [
  { id: 'participants', label: 'Участники', icon: Users },
  { id: 'chat', label: 'Чат', icon: MessageCircle },
  { id: 'materials', label: 'Материалы', icon: BookOpen },
  { id: 'homework', label: 'ДЗ', icon: NotebookPen },
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
}) {
  const { user } = useAuth();
  const tabs = useMemo(() => {
    if (!canManageAttendance) return BASE_TABS;
    const next = [...BASE_TABS];
    next.splice(1, 0, ATTENDANCE_TAB);
    return next;
  }, [canManageAttendance]);

  const [tab, setTab] = useState('participants');
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
  const [statusBusy, setStatusBusy] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    if (!canManageAttendance && tab === 'attendance') {
      setTab('participants');
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

  // Bind lesson chat early so history persists and in-lesson unread works
  // without putting this chat into the global «Чаты» list.
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
    if (tab === 'chat' && chatId) {
      void loadChatMessages(chatId);
      setChatUnread(0);
      void chatsApi.markRead(chatId).catch(() => {});
    }
  }, [tab, loadParticipants, loadHomework, loadChatMessages, chatId]);

  const rosterWithPresence = useMemo(() => {
    const matchedLiveIds = new Set();
    const rows = participants.map((p) => {
      const presence = findLivePresence(p.name, livePresence);
      if (presence?.id) matchedLiveIds.add(presence.id);
      const online = Boolean(presence?.online);
      return {
        ...p,
        presence,
        online,
        joinedAt: presence?.joinedAt || presence?.joined_at || null,
        connectionStatus: participantConnectionLabel({ online, presence }),
      };
    });

    for (const live of livePresence || []) {
      if (!live?.id || matchedLiveIds.has(live.id)) continue;
      const online = Boolean(live.online);
      rows.push({
        role: 'guest',
        name: live.displayName || live.display_name || 'Участник',
        presence: live,
        online,
        joinedAt: live.joinedAt || live.joined_at || null,
        connectionStatus: participantConnectionLabel({ online, presence: live }),
      });
    }
    return rows;
  }, [participants, livePresence]);

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

  return (
    <aside
      className={cn(
        'flex flex-col border border-slate-800 bg-slate-950 text-slate-100 overflow-hidden',
        compact ? 'h-full min-h-0 rounded-t-2xl border-0' : 'h-full min-h-0 rounded-2xl',
      )}
      data-testid="lesson-video-side-rail"
    >
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 p-2 shrink-0 scrollbar-none">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
              tab === id
                ? 'bg-brand/20 text-brand'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === 'chat' && chatUnread > 0 ? (
              <span
                className="ml-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white"
                data-testid="lesson-video-chat-unread"
              >
                {chatUnread > 99 ? '99+' : chatUnread}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 text-sm space-y-3">
        {tab === 'materials' && (
          <div className="space-y-3">
            <p className="text-slate-400 text-xs leading-relaxed">
              Материалы урока открываются в CRM без выхода из видеозвонка — вернитесь сюда через «Назад» в браузере или вкладку урока.
            </p>
            <Button asChild className="w-full min-h-11">
              <Link to={materialsPath}>Открыть материалы</Link>
            </Button>
            {lesson?.notes ? (
              <div className="rounded-lg bg-slate-900 p-3 text-xs whitespace-pre-wrap text-slate-300">
                {lesson.notes}
              </div>
            ) : null}
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
                    className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                  >
                    <p className="font-medium text-xs">
                      {row.title || row.homework?.title || 'Домашнее задание'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Нет ДЗ, привязанных к этому уроку.</p>
            )}
            <Button asChild variant="outline" className="w-full min-h-11 border-slate-700">
              <Link to={homeworkPath}>
                {isHost ? 'Назначить / список ДЗ' : 'Мои задания'}
              </Link>
            </Button>
          </div>
        )}

        {tab === 'participants' && (
          <div className="space-y-3" data-testid="lesson-video-participants">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>В уроке (CRM): {participants.length}</span>
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
                    className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className={cn(
                          'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                          p.online ? 'bg-emerald-500' : 'bg-slate-600',
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate font-medium text-xs">{p.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {roleLabel(p.role)}
                          {' · '}
                          {p.online ? 'онлайн' : 'офлайн'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Подключение: {formatJoinedAt(p.joinedAt)}
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
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Отметьте посещаемость вручную. Если ученик был в конференции достаточно долго,
              система предложит статус «Был» — вы всегда можете выбрать другой.
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
                      className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-xs">{p.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {p.connectionStatus}
                          {' · '}
                          {localizeAttendanceStatus(status)}
                        </p>
                        {suggestPresent ? (
                          <p
                            className="mt-1 text-[11px] text-emerald-400"
                            data-testid="attendance-suggest-present"
                          >
                            Рекомендуем: Был (достаточно долго в конференции)
                          </p>
                        ) : null}
                      </div>
                      {p.attendance_id ? (
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
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
                                  'min-h-11 px-2 text-[11px] whitespace-normal leading-tight',
                                  !active && 'border-slate-700',
                                  btn.suggest && !active && 'ring-1 ring-emerald-500/50',
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
                        <p className="text-[11px] text-amber-400/90">
                          Нет записи посещаемости для этого ученика
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Нет учеников для отметки посещаемости.</p>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex h-full min-h-[240px] flex-col gap-2">
            {loadingChat && !messages.length ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto rounded-lg bg-slate-900/80 p-2">
                {messages.length ? (
                  messages.map((m) => (
                    <div key={m.id} className="text-xs leading-relaxed">
                      <span className="font-medium text-brand">
                        {m.sender_name || m.senderName || m.user?.firstName || 'Участник'}
                        :{' '}
                      </span>
                      <span className="text-slate-200">{messageBody(m)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">Сообщений пока нет</p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500"
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
          <div className="space-y-3 text-xs text-slate-300">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1.5">
              <p>
                <span className="text-slate-500">Урок:</span>{' '}
                <span className="font-medium text-slate-100">{lesson?.title || 'Онлайн-урок'}</span>
              </p>
              <p>
                <span className="text-slate-500">Предмет:</span> {subject || '—'}
              </p>
              <p>
                <span className="text-slate-500">Преподаватель:</span>{' '}
                {lesson?.teacher_name || '—'}
              </p>
              <p>
                <span className="text-slate-500">Время:</span> {timeRange || '—'}
              </p>
              {connectionLabel ? (
                <p>
                  <span className="text-slate-500">Статус:</span> {connectionLabel}
                </p>
              ) : null}
              {lesson?.group_name ? (
                <p>
                  <span className="text-slate-500">Группа:</span> {lesson.group_name}
                </p>
              ) : null}
            </div>
            {isHost ? (
              <div className="space-y-2">
                <p className="text-slate-500">Действия преподавателя</p>
                <Button
                  type="button"
                  className="w-full min-h-11"
                  disabled={statusBusy}
                  onClick={() => void completeLesson()}
                >
                  Отметить урок завершённым
                </Button>
                <Button asChild variant="outline" className="w-full min-h-11 border-slate-700">
                  <Link to={homeworkPath}>Назначить домашнее задание</Link>
                </Button>
                <Button asChild variant="ghost" className="w-full min-h-11">
                  <Link to={createPageUrl('TeacherSchedule')}>К расписанию</Link>
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
