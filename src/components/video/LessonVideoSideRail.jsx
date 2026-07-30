import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  NotebookPen,
  Users,
  MessageCircle,
  ClipboardCheck,
  Loader2,
  Send,
} from 'lucide-react';
import { api } from '@/api';
import { chatsApi } from '@/api/chats.api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import { createPageUrl } from '@/utils';

const TABS = [
  { id: 'materials', label: 'Материалы', icon: BookOpen },
  { id: 'homework', label: 'ДЗ', icon: NotebookPen },
  { id: 'participants', label: 'Участники', icon: Users },
  { id: 'chat', label: 'Чат', icon: MessageCircle },
  { id: 'actions', label: 'После урока', icon: ClipboardCheck },
];

function messageBody(row) {
  return row?.body || row?.text || row?.content || '';
}

export default function LessonVideoSideRail({
  lessonId,
  lesson,
  isHost,
  isStudent,
  materialsPath,
  homeworkPath,
  compact = false,
}) {
  const [tab, setTab] = useState(isHost ? 'participants' : 'materials');
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
      setMessages(rows);
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
    if (tab === 'chat') void ensureChat();
  }, [tab, loadParticipants, loadHomework, ensureChat]);

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
      setMessages(rows);
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

  const visibleTabs = TABS.filter((t) => (t.id === 'actions' ? isHost : true));

  return (
    <aside
      className={`flex flex-col border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden ${
        compact ? 'h-[min(70dvh,520px)]' : 'h-full min-h-[320px]'
      }`}
      data-testid="lesson-video-side-rail"
    >
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800 p-2">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              tab === id
                ? 'bg-brand/15 text-brand'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 text-sm space-y-3">
        {tab === 'materials' && (
          <div className="space-y-2">
            <p className="text-slate-500 text-xs">
              Учебные материалы урока открываются в разделе материалов CRM.
            </p>
            <Button asChild size="sm" className="w-full">
              <Link to={materialsPath}>Открыть материалы</Link>
            </Button>
            {lesson?.notes ? (
              <div className="rounded-md bg-slate-50 dark:bg-slate-950 p-2 text-xs whitespace-pre-wrap">
                {lesson.notes}
              </div>
            ) : null}
          </div>
        )}

        {tab === 'homework' && (
          <div className="space-y-2">
            {loadingHw ? (
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
            ) : homework.length ? (
              <ul className="space-y-2">
                {homework.map((row) => (
                  <li
                    key={row.id || row.assignment_id}
                    className="rounded-md border border-slate-200 dark:border-slate-800 p-2"
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
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to={homeworkPath}>
                {isHost ? 'Назначить / список ДЗ' : 'Мои задания'}
              </Link>
            </Button>
          </div>
        )}

        {tab === 'participants' && (
          <div className="space-y-2">
            {loadingPeople ? (
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
            ) : (
              <ul className="space-y-2">
                {participants.map((p, idx) => (
                  <li
                    key={`${p.role}-${p.student_id || p.name}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 dark:border-slate-800 p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-xs">{p.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {p.role === 'teacher' ? 'преподаватель' : 'ученик'}
                        {p.attendance_status ? ` · ${p.attendance_status}` : ''}
                      </p>
                    </div>
                    {isHost && p.attendance_id ? (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={statusBusy}
                          className="h-7 px-2 text-[11px]"
                          onClick={() => markAttendance(p.attendance_id, true)}
                        >
                          Был
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={statusBusy}
                          className="h-7 px-2 text-[11px]"
                          onClick={() => markAttendance(p.attendance_id, false)}
                        >
                          Нет
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex h-full min-h-[220px] flex-col gap-2">
            {loadingChat ? (
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto rounded-md bg-slate-50 dark:bg-slate-950 p-2">
                {messages.length ? (
                  messages.map((m) => (
                    <div key={m.id} className="text-xs">
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        {m.sender_name || m.senderName || m.user?.firstName || 'Участник'}
                        :{' '}
                      </span>
                      <span>{messageBody(m)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">Сообщений пока нет</p>
                )}
              </div>
            )}
            <div className="flex gap-1">
              <input
                className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs"
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
                size="sm"
                disabled={sending || !draft.trim()}
                onClick={() => void sendChat()}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {tab === 'actions' && isHost && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Действия после урока: посещаемость, ДЗ и статус урока.
            </p>
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={statusBusy}
              onClick={() => void completeLesson()}
            >
              Отметить урок завершённым
            </Button>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to={homeworkPath}>Назначить домашнее задание</Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="w-full">
              <Link to={createPageUrl('TeacherSchedule')}>К расписанию</Link>
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
