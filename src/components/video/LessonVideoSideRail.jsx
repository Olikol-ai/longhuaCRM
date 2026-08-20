import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  NotebookPen,
  MessageCircle,
  Loader2,
  Paperclip,
  Send,
} from 'lucide-react';
import { api } from '@/api';
import { chatsApi } from '@/api/chats.api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  connectChatSocket,
  joinChat,
  leaveChat,
  subscribeToChatSocket,
} from '@/lib/chat-socket';
import { normalizeMessage } from '@/lib/chat-normalize';
import { openMaterial } from '@/lib/materialUrl';
import { isInAppMediaMaterial } from '@/lib/materialMeta';
import { chatAttachmentSrc } from '@/lib/chat-attachment-url';
import AuthenticatedAudio from '@/components/media/AuthenticatedAudio';
import MaterialMediaPreview from '@/components/materials/MaterialMediaPreview';

/** Chat + study tools only (participants / info / attendance are overlays). */
const BASE_TABS = [
  { id: 'chat', label: 'Чат', icon: MessageCircle },
  { id: 'materials', label: 'Материалы', icon: BookOpen },
  { id: 'homework', label: 'ДЗ', icon: NotebookPen },
];

function messageBody(row) {
  return row?.body || row?.text || row?.content || '';
}

function isLessonAudioAttachment(att) {
  if (!att) return false;
  const mime = String(att.mime || '').toLowerCase();
  if (mime.startsWith('audio/')) return true;
  if (att.kind === 'voice') return true;
  const name = String(att.originalFilename || att.original_filename || '').toLowerCase();
  return /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i.test(name);
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

/**
 * Drawer content for chat / materials / homework during a live lesson.
 * Never hosts permanent participants / info / attendance tabs.
 */
export default function LessonVideoSideRail({
  lessonId,
  lesson,
  isHost,
  isStudent,
  materialsPath,
  homeworkPath,
  compact = false,
  activeTab,
  onActiveTabChange,
  onChatUnreadChange,
  onChatToast,
  onRequestNavigate,
  chatPanelVisible = false,
}) {
  const { user } = useAuth();
  const chatVisibleRef = useRef(chatPanelVisible);
  const tabRef = useRef(activeTab || 'chat');
  const tabs = useMemo(() => BASE_TABS, []);

  const [internalTab, setInternalTab] = useState(activeTab || 'chat');
  const tab = activeTab ?? internalTab;
  const setTab = (next) => {
    if (onActiveTabChange) onActiveTabChange(next);
    else setInternalTab(next);
  };

  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const audioInputRef = useRef(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [homework, setHomework] = useState([]);
  const [loadingHw, setLoadingHw] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [openingMaterialId, setOpeningMaterialId] = useState(null);
  const [previewMaterial, setPreviewMaterial] = useState(null);

  useEffect(() => {
    chatVisibleRef.current = chatPanelVisible;
  }, [chatPanelVisible]);

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
      if (isInAppMediaMaterial(material)) {
        setPreviewMaterial(material);
        return;
      }
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
      setMessages(
        [...rows]
          .map((row) => normalizeMessage(row))
          .filter(Boolean)
          .reverse(),
      );
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
        if (!mine && !chatVisibleRef.current) {
          setChatUnread((n) => n + 1);
          onChatToast?.({
            sender:
              next.sender_name ||
              next.senderName ||
              next.senderUser?.firstName ||
              'Участник',
            body: messageBody(next),
          });
        }
      },
    });
  }, [chatId, user?.id, onChatToast]);

  useEffect(() => {
    if (tab === 'homework') void loadHomework();
    if (tab === 'materials') void loadMaterials();
    if (tab === 'chat' && chatId) {
      void loadChatMessages(chatId);
      setChatUnread(0);
      void chatsApi.markRead(chatId).catch(() => {});
    }
  }, [tab, loadHomework, loadMaterials, loadChatMessages, chatId]);

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

  const sendAudioFile = async (file) => {
    if (!file) return;
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
      await chatsApi.uploadAttachment(id, file, { kind: 'file' });
      if (draft.trim()) {
        await chatsApi.sendMessage(id, { body: draft.trim() });
        setDraft('');
      }
      await loadChatMessages(id);
      setChatUnread(0);
      void chatsApi.markRead(id).catch(() => {});
      toast({
        title: 'Аудио отправлено',
        description: 'Ученики могут прослушать запись в чате урока.',
      });
    } catch (err) {
      toast({
        title: 'Не удалось отправить аудио',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const muted = 'text-muted-foreground';
  const soft = 'text-muted-foreground';
  const panel = 'border-border bg-muted/40';
  const inputCls =
    'border-border bg-background text-foreground placeholder:text-muted-foreground';

  return (
    <aside
      className="flex h-full min-h-0 flex-col overflow-hidden bg-card text-card-foreground"
      data-testid="lesson-video-side-rail"
    >
      <div className="flex max-w-full shrink-0 flex-wrap gap-1 overflow-x-hidden border-b border-border p-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex h-9 max-w-full items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors sm:h-10 sm:px-3 sm:text-xs',
              tab === id
                ? 'bg-brand/15 text-brand'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span className="truncate">{label}</span>
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

      <div
        className={cn(
          'min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain text-sm',
          compact ? 'p-2.5' : 'p-3',
          tab === 'chat' && 'flex flex-col',
        )}
      >
        {tab === 'materials' && (
          <div className="space-y-3" data-testid="lesson-video-materials">
            <p className={cn('text-xs leading-relaxed', muted)}>
              Материалы открываются здесь. Каталог CRM — в мини-режиме урока,
              видеозвонок не прерывается.
            </p>
            {loadingMaterials ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            ) : materials.length ? (
              <ul className="space-y-2">
                {materials.map((mat) => (
                  <li key={mat.id} className={cn('rounded-xl border p-3', panel)}>
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
                          <ChevronRight className="mr-2 h-4 w-4" />
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
              <div
                className={cn(
                  'rounded-xl border p-3 text-xs whitespace-pre-wrap',
                  panel,
                  muted,
                )}
              >
                {lesson.notes}
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-11"
              onClick={() => onRequestNavigate?.(materialsPath, 'каталог материалов')}
            >
              <ChevronRight className="mr-2 h-4 w-4" />
              Показать все материалы
            </Button>
          </div>
        )}

        {tab === 'homework' && (
          <div className="space-y-3" data-testid="lesson-video-homework">
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
              onClick={() => onRequestNavigate?.(homeworkPath, 'домашние задания')}
            >
              <ChevronRight className="mr-2 h-4 w-4" />
              {isHost ? 'Назначить / список ДЗ' : 'Мои задания'}
            </Button>
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex h-full min-h-[220px] flex-1 flex-col gap-2">
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
                  messages.map((m) => {
                    const attachments = Array.isArray(m.attachments) ? m.attachments : [];
                    const audioAtt = attachments.find(isLessonAudioAttachment);
                    return (
                      <div key={m.id} className="space-y-1.5 text-xs leading-relaxed">
                        <p>
                          <span className="font-medium text-brand">
                            {m.sender_name ||
                              m.senderName ||
                              m.senderUser?.firstName ||
                              'Участник'}
                            :{' '}
                          </span>
                          <span className="text-foreground">{messageBody(m)}</span>
                        </p>
                        {audioAtt ? (
                          <AuthenticatedAudio
                            src={chatAttachmentSrc(audioAtt.id)}
                            wrapperClassName="mt-1"
                          />
                        ) : null}
                        {attachments
                          .filter((a) => a && !isLessonAudioAttachment(a))
                          .map((a) => (
                            <a
                              key={a.id}
                              className="block text-[11px] text-brand underline"
                              href={chatAttachmentSrc(a.id)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {a.originalFilename || a.original_filename || 'Файл'}
                            </a>
                          ))}
                      </div>
                    );
                  })
                ) : (
                  <p className={cn('text-xs', soft)}>Сообщений пока нет</p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void sendAudioFile(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-11"
                disabled={sending}
                aria-label="Прикрепить аудио"
                title="Отправить аудиофайл ученикам"
                onClick={() => audioInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                className={cn('min-h-11 flex-1 rounded-xl border px-3 text-sm', inputCls)}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Сообщение или подпись к аудио…"
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
      </div>

      {previewMaterial ? (
        <MaterialMediaPreview
          material={previewMaterial}
          onClose={() => setPreviewMaterial(null)}
        />
      ) : null}
    </aside>
  );
}
