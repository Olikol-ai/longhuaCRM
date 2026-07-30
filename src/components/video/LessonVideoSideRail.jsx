import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
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

const TABS = [
  { id: 'participants', label: 'Участники', icon: Users },
  { id: 'chat', label: 'Чат', icon: MessageCircle },
  { id: 'materials', label: 'Материалы', icon: BookOpen },
  { id: 'homework', label: 'ДЗ', icon: NotebookPen },
  { id: 'info', label: 'Инфо', icon: Info },
];

function messageBody(row) {
  return row?.body || row?.text || row?.content || '';
}

function roleLabel(role) {
  if (role === 'teacher') return 'преподаватель';
  if (role === 'tutor') return 'репетитор';
  if (role === 'student') return 'ученик';
  return role || 'участник';
}

export default function LessonVideoSideRail({
  lessonId,
  lesson,
  isHost,
  isStudent,
  materialsPath,
  homeworkPath,
  compact = false,
  jitsiParticipantCount = null,
  timeRange = '',
  subject = '',
  connectionLabel = '',
}) {
  const [tab, setTab] = useState('participants');
  const [participants, setParticipants] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [homework, setHomework] = useState([]);
  const [loadingHw, setLoadingHw] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

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

  const ensureChat = useCallback(async () => {
    if (!lessonId) return null;
    setLoadingChat(true);
    try {
      const chat = await api.video.ensureLessonChat(lessonId);
      const id = chat.id || chat.chat_id;
      setChatId(id);
      const msgs = await chatsApi.messages(id, { limit: 50 });
      const rows = Array.isArray(msgs) ? msgs : msgs?.items || msgs?.messages || [];
      setMessages([...rows].reverse());
      return id;
    } catch (err) {
      toast({
        title: 'Чат урока недоступен',
        description: userFacingError(err),
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoadingChat(false);
    }
  }, [lessonId]);

  useEffect(() => {
    if (tab === 'participants') void loadParticipants();
    if (tab === 'homework') void loadHomework();
    if (tab === 'chat' && !chatId) void ensureChat();
  }, [tab, loadParticipants, loadHomework, ensureChat, chatId]);

  const sendChat = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      let id = chatId;
      if (!id) id = await ensureChat();
      if (!id) return;
      await chatsApi.sendMessage(id, { body: text });
      setDraft('');
      const msgs = await chatsApi.messages(id, { limit: 50 });
      const rows = Array.isArray(msgs) ? msgs : msgs?.items || msgs?.messages || [];
      setMessages([...rows].reverse());
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

  const markAttendance = async (attendanceId, present) => {
    if (!attendanceId) return;
    setStatusBusy(true);
    try {
      if (present) {
        await api.lessons.attendance.present(attendanceId);
      } else {
        await api.lessons.attendance.absent(attendanceId);
      }
      await loadParticipants();
      toast({ title: present ? 'Отмечен присутствующим' : 'Отмечен отсутствующим' });
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
        {TABS.map(({ id, label, icon: Icon }) => (
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
          <div className="space-y-3">
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
                {participants.map((p, idx) => {
                  const online =
                    p.online === true ||
                    p.is_online === true ||
                    p.attendance_status === 'present';
                  return (
                    <li
                      key={`${p.role}-${p.student_id || p.name}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <div className="min-w-0 flex items-start gap-2">
                        <span
                          className={cn(
                            'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                            online ? 'bg-emerald-500' : 'bg-slate-600',
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-xs">{p.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {roleLabel(p.role)}
                            {online ? ' · онлайн' : ' · отключён'}
                            {p.attendance_status ? ` · ${p.attendance_status}` : ''}
                          </p>
                        </div>
                      </div>
                      {isHost && p.attendance_id ? (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={statusBusy}
                            className="min-h-11 px-3 text-[11px] border-slate-700"
                            onClick={() => markAttendance(p.attendance_id, true)}
                          >
                            Был
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={statusBusy}
                            className="min-h-11 px-3 text-[11px]"
                            onClick={() => markAttendance(p.attendance_id, false)}
                          >
                            Нет
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
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
