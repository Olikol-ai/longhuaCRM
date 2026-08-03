import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Download,
  Eye,
  FileQuestion,
  Headphones,
  Loader2,
  Pencil,
  Plus,
  BookOpen,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '@/api';
import ListeningTaskEditor from '@/components/assessment/ListeningTaskEditor';
import LifecycleBadge from '@/components/assessment/LifecycleBadge';
import ExamCreateDialog from '@/components/assessment/ExamCreateDialog';
import QuestionFormDialog from '@/components/assessment/QuestionFormDialog';
import QuestionPreviewDialog from '@/components/assessment/QuestionPreviewDialog';
import ReadingTaskEditor from '@/components/assessment/ReadingTaskEditor';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { useAssessmentQuestions } from '@/hooks/useAssessmentQuestions';
import { useAuth } from '@/lib/AuthContext';
import {
  CONTENT_TASK_TYPE_LABEL,
  QUESTION_TYPE_LABEL,
  QUESTION_TYPES,
  formatDateTime,
  unwrapItems,
} from '@/lib/assessment-admin';

const TABS = [
  { id: 'questions', label: 'Тест', icon: FileQuestion },
  { id: 'listening', label: 'Аудирование', icon: Headphones },
  { id: 'reading', label: 'Чтение', icon: BookOpen },
];

export default function AssessmentQuestions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('questions');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const { questions, loading, error, reload, removeQuestion } = useAssessmentQuestions({
    type,
    status,
    search: searchApplied,
  });

  const [sectionTasks, setSectionTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogType, setTaskDialogType] = useState('listening');
  const [editingTask, setEditingTask] = useState(null);
  const fileInputRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [dialogMode, setDialogMode] = useState('create');
  const [confirmAction, setConfirmAction] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [ownerNames, setOwnerNames] = useState({});
  const [authorFilter, setAuthorFilter] = useState('');
  const [previewId, setPreviewId] = useState(null);
  const [examCreateOpen, setExamCreateOpen] = useState(false);
  const [examPrefillQuestionId, setExamPrefillQuestionId] = useState(null);

  const loadSectionTasks = useCallback(async () => {
    if (tab === 'questions') return;
    setTasksLoading(true);
    setTasksError(null);
    try {
      const rows =
        tab === 'reading'
          ? await api.assessment.listReadingTasks()
          : await api.assessment.listListeningTasks();
      const list = Array.isArray(rows) ? rows : unwrapItems(rows);
      // API DTO does not include task_type; stamp it from the active tab so Edit opens the right editor.
      setSectionTasks(
        list.map((row) => ({
          ...row,
          task_type: tab === 'reading' ? 'reading' : 'listening',
        })),
      );
    } catch (err) {
      setTasksError(err);
      setSectionTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void loadSectionTasks();
  }, [loadSectionTasks]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.users.directory();
        const list = Array.isArray(rows) ? rows : unwrapItems(rows);
        const next = {};
        for (const u of list) {
          if (!u?.id) continue;
          next[u.id] =
            u.full_name ||
            [u.first_name, u.last_name].filter(Boolean).join(' ') ||
            u.email ||
            u.id.slice(0, 8);
        }
        if (!cancelled) setOwnerNames(next);
      } catch {
        /* directory may be admin-only; owner labels fall back to id */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const canDeleteQuestion = (question) =>
    isAdmin ||
    (Boolean(user?.id) &&
      Boolean(question?.created_by_user_id) &&
      question.created_by_user_id === user.id);

  const canDeleteTask = (task) =>
    isAdmin ||
    (Boolean(user?.id) &&
      Boolean(task?.created_by_user_id) &&
      task.created_by_user_id === user.id);

  const openCreate = () => {
    setPreviewId(null);
    setEditing(null);
    setDialogMode('create');
    setDialogOpen(true);
  };

  /**
   * Accept a question object or raw id (preview / copy flows may pass either).
   * Always close preview first so Radix does not leave body pointer-events:none.
   */
  const openEdit = (questionOrId, mode = 'edit') => {
    const normalized =
      typeof questionOrId === 'string'
        ? { id: questionOrId }
        : questionOrId && typeof questionOrId === 'object'
          ? questionOrId
          : null;
    if (!normalized?.id) {
      toast({
        title: 'Не удалось открыть вопрос',
        description: 'Не найден идентификатор вопроса для редактирования.',
        variant: 'destructive',
      });
      return;
    }

    const startEdit = () => {
      setEditing(normalized);
      setDialogMode(mode === 'create' ? 'create' : 'edit');
      setDialogOpen(true);
    };

    if (previewId) {
      setPreviewId(null);
      // Let the preview dialog fully unmount before opening the editor.
      window.setTimeout(startEdit, 50);
      return;
    }
    startEdit();
  };

  const openCreateTask = (kind) => {
    setTaskDialogType(kind);
    setEditingTask(null);
    setTaskDialogOpen(true);
  };

  /**
   * Open Reading/Listening editor for an existing task.
   * Prefer explicit task_type; fall back to the active tab (list DTOs historically omit task_type).
   */
  const openEditTask = (task) => {
    if (!task?.id) {
      toast({
        title: 'Не удалось открыть задание',
        description: 'Не найден идентификатор задания для редактирования.',
        variant: 'destructive',
      });
      return;
    }
    const kind =
      task.task_type === 'reading' || task.task_type === 'listening'
        ? task.task_type
        : tab === 'reading' || tab === 'listening'
          ? tab
          : null;
    if (!kind) {
      toast({
        title: 'Не удалось открыть задание',
        description: 'Неизвестный тип задания (чтение / аудирование).',
        variant: 'destructive',
      });
      return;
    }
    setEditingTask({ ...task, task_type: kind });
    setTaskDialogType(kind);
    setTaskDialogOpen(true);
  };

  const closeTaskDialog = () => {
    setTaskDialogOpen(false);
    setEditingTask(null);
  };

  const runLifecycle = async (event) => {
    event?.preventDefault?.();
    const action = confirmAction;
    if (!action) return;
    setBusyId(action.question?.id || action.task?.id);
    try {
      if (action.question) {
        const { question, type: actionType } = action;
        if (actionType === 'publish') {
          await api.assessment.publishQuestion(question.id);
          toast({ title: 'Вопрос опубликован' });
          reload();
        } else if (actionType === 'archive') {
          await api.assessment.archiveQuestion(question.id);
          toast({ title: 'Вопрос архивирован' });
          reload();
        } else if (actionType === 'delete') {
          await api.assessment.deleteQuestion(question.id);
          removeQuestion(question.id);
          setPreviewId((prev) => (prev === question.id ? null : prev));
          toast({ title: 'Вопрос успешно удалён.' });
        }
      } else if (action.task) {
        const { task, type: actionType } = action;
        const isReading = tab === 'reading';
        if (actionType === 'publish') {
          if (isReading) await api.assessment.publishReadingTask(task.id);
          else await api.assessment.publishListeningTask(task.id);
          toast({ title: 'Задача опубликована' });
          await loadSectionTasks();
        } else if (actionType === 'delete') {
          if (isReading) await api.assessment.deleteReadingTask(task.id);
          else await api.assessment.deleteListeningTask(task.id);
          toast({ title: 'Задача удалена' });
          await loadSectionTasks();
        }
      }
      setConfirmAction(null);
    } catch (err) {
      toast({
        title: 'Операция не выполнена',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const confirmCopy = {
    publish: {
      title: 'Опубликовать?',
      description: 'После публикации элемент станет доступен в ДЗ и экзаменах.',
      confirmLabel: 'Подтвердить',
    },
    archive: {
      title: 'Архивировать вопрос?',
      description: 'Вопрос будет переведён в архив.',
      confirmLabel: 'Подтвердить',
    },
    delete: {
      title: 'Удалить?',
      description: 'Это действие нельзя отменить.',
      confirmLabel: 'Удалить',
    },
  };

  const handleExport = () => {
    if (questions.length === 0) {
      toast({
        title: 'Нечего экспортировать',
        description: 'Сначала создайте вопросы.',
        variant: 'destructive',
      });
      return;
    }
    const payload = {
      version: 2,
      exported_at: new Date().toISOString(),
      questions: questions.map((question) => ({
        type: question.type,
        stem: question.stem,
        points: question.points,
        difficulty: question.difficulty,
        explanation: question.explanation,
        answers: (question.answers || []).map((answer) => ({
          text: answer.text || answer.body,
          is_correct: Boolean(answer.is_correct),
          sort_order: answer.sort_order,
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assessment-questions-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const importedQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
      if (!Array.isArray(importedQuestions) || importedQuestions.length === 0) {
        throw new Error('Файл не содержит вопросов');
      }
      setBusyId('import');
      for (const item of importedQuestions) {
        if (!QUESTION_TYPES.includes(item.type)) continue;
        await api.assessment.createQuestion({
          type: item.type,
          stem: item.stem,
          points: item.points,
          difficulty: item.difficulty,
          explanation: item.explanation,
          answers: (item.answers || []).map((answer) => ({
            text: answer.text || answer.body,
            is_correct: Boolean(answer.is_correct),
            sort_order: answer.sort_order,
          })),
        });
      }
      toast({ title: 'Вопросы импортированы' });
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось импортировать',
        description: err?.message || 'Проверьте формат JSON файла.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const filteredTasks = useMemo(() => {
    const needle = searchApplied.trim().toLowerCase();
    return sectionTasks.filter((t) => {
      if (status && t.status !== status) return false;
      if (authorFilter && t.created_by_user_id !== authorFilter) return false;
      if (needle && !String(t.title || '').toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [sectionTasks, searchApplied, status, authorFilter]);

  const visibleQuestions = useMemo(() => {
    if (!authorFilter) return questions;
    return questions.filter((q) => q.created_by_user_id === authorFilter);
  }, [questions, authorFilter]);

  const authorOptions = useMemo(() => {
    const ids = new Set();
    for (const q of questions) {
      if (q.created_by_user_id) ids.add(q.created_by_user_id);
    }
    for (const t of sectionTasks) {
      if (t.created_by_user_id) ids.add(t.created_by_user_id);
    }
    return [...ids].map((id) => ({
      id,
      name: ownerNames[id] || id.slice(0, 8),
    }));
  }, [questions, sectionTasks, ownerNames]);

  const ownerTree = useMemo(() => {
    if (!isAdmin) return null;
    const items =
      tab === 'questions'
        ? visibleQuestions.map((q) => ({
            id: q.id,
            ownerId: q.created_by_user_id,
            date: q.updated_at || q.created_at,
            title: q.stem,
            status: q.status,
            kind: 'question',
            raw: q,
          }))
        : filteredTasks.map((t) => ({
            id: t.id,
            ownerId: t.created_by_user_id,
            date: t.updated_at || t.created_at,
            title: t.title,
            status: t.status,
            kind: 'task',
            raw: t,
          }));
    const byOwner = new Map();
    for (const item of items) {
      const key = item.ownerId || 'unknown';
      if (!byOwner.has(key)) byOwner.set(key, []);
      byOwner.get(key).push(item);
    }
    return [...byOwner.entries()].map(([ownerId, rows]) => ({
      ownerId,
      ownerName: ownerNames[ownerId] || ownerId?.slice?.(0, 8) || 'Без автора',
      rows: rows.sort((a, b) => new Date(b.date) - new Date(a.date)),
    }));
  }, [isAdmin, tab, visibleQuestions, filteredTasks, ownerNames]);

  const previewQuestionIds = useMemo(() => {
    if (isAdmin && ownerTree && tab === 'questions') {
      return ownerTree.flatMap((g) => g.rows.map((r) => r.id));
    }
    return visibleQuestions.map((q) => q.id);
  }, [isAdmin, ownerTree, tab, visibleQuestions]);

  const previewQuestion = useMemo(
    () => visibleQuestions.find((q) => q.id === previewId) || null,
    [visibleQuestions, previewId],
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Вопросы</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin
              ? 'Вопросы всех авторов: тесты, аудирование и чтение'
              : 'Тестовые вопросы, задания на аудирование и чтение'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (tab === 'questions' ? reload() : loadSectionTasks())}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          {tab === 'questions' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={questions.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Экспорт
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busyId === 'import'}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Импорт
              </Button>
              <Button className="bg-primary hover:bg-primary/90" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Создать тест
              </Button>
            </>
          )}
          {tab === 'listening' && (
            <Button
              className="bg-primary hover:bg-primary/90"
              size="sm"
              onClick={() => openCreateTask('listening')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать аудирование
            </Button>
          )}
          {tab === 'reading' && (
            <Button
              className="bg-primary hover:bg-primary/90"
              size="sm"
              onClick={() => openCreateTask('reading')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать чтение
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={tab === t.id ? 'default' : 'outline'}
              onClick={() => setTab(t.id)}
            >
              <Icon className="h-4 w-4 mr-1.5" />
              {t.label}
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Поиск…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearchApplied(search.trim());
            }}
          />
        </div>
        {tab === 'questions' && (
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Все типы</option>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        )}
        {isAdmin && (
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
          >
            <option value="">Все авторы</option>
            {authorOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="published">Опубликован</option>
          <option value="archived">В архиве</option>
        </select>
      </div>
      <Button variant="outline" size="sm" onClick={() => setSearchApplied(search.trim())}>
        Применить фильтры
      </Button>

      {(error || tasksError) && (
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <p className="font-medium">Ошибка загрузки</p>
          <p className="mt-1">{(error || tasksError)?.message}</p>
        </div>
      )}

      {tab === 'questions' ? (
        loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : visibleQuestions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center space-y-3">
            <FileQuestion className="h-10 w-10 mx-auto text-slate-400" />
            <h2 className="text-lg font-semibold">Вопросов не найдено</h2>
            <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Создать тест
            </Button>
          </div>
        ) : isAdmin && ownerTree ? (
          <div className="space-y-6">
            {ownerTree.map((group) => (
              <section key={group.ownerId} className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Автор: {group.ownerName}
                </h2>
                {group.rows.map((row) => (
                  <QuestionCardRow
                    key={row.id}
                    q={row.raw}
                    busyId={busyId}
                    canDelete={canDeleteQuestion(row.raw)}
                    onPreview={setPreviewId}
                    onEdit={openEdit}
                    onConfirm={setConfirmAction}
                    authorName={group.ownerName}
                    showAuthor={false}
                  />
                ))}
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleQuestions.map((q) => (
              <QuestionCardRow
                key={q.id}
                q={q}
                busyId={busyId}
                canDelete={canDeleteQuestion(q)}
                onPreview={setPreviewId}
                onEdit={openEdit}
                onConfirm={setConfirmAction}
                authorName={
                  q.created_by_user_id
                    ? ownerNames[q.created_by_user_id] || q.created_by_user_id.slice(0, 8)
                    : null
                }
                showAuthor={isAdmin}
              />
            ))}
          </div>
        )
      ) : tasksLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center space-y-3">
          <p className="text-sm text-slate-500">Задач пока нет</p>
          <Button onClick={() => openCreateTask(tab)}>
            <Plus className="h-4 w-4 mr-2" />
            Создать {CONTENT_TASK_TYPE_LABEL[tab]}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(isAdmin && ownerTree ? ownerTree.flatMap((g) => g.rows.map((r) => r.raw)) : filteredTasks).map(
            (task) => (
              <article
                key={task.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs rounded-full px-2 py-0.5 bg-brand-soft text-brand">
                        {CONTENT_TASK_TYPE_LABEL[task.task_type] || task.task_type}
                      </span>
                      <LifecycleBadge status={task.status} />
                      {isAdmin && task.created_by_user_id ? (
                        <span className="text-xs text-slate-500">
                          {ownerNames[task.created_by_user_id] || task.created_by_user_id.slice(0, 8)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm sm:text-base font-medium">{task.title}</p>
                    <p className="text-xs text-slate-400">
                      Вопросов: {(task.questions || []).length} ·{' '}
                      {formatDateTime(task.updated_at || task.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid={`task-edit-${task.id}`}
                      onClick={() => openEditTask(task)}
                    >
                      {task.status === 'archived' ? (
                        <Eye className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                      )}
                      {task.status === 'archived' ? 'Просмотр' : 'Изменить'}
                    </Button>
                    {task.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === task.id}
                        onClick={() => setConfirmAction({ type: 'publish', task })}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Опубликовать
                      </Button>
                    )}
                    {canDeleteTask(task) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600"
                        disabled={busyId === task.id}
                        onClick={() => setConfirmAction({ type: 'delete', task })}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Удалить
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ),
          )}
        </div>
      )}

      <QuestionFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setDialogMode('create');
          }
        }}
        mode={dialogMode}
        question={editing}
        onSaved={() => {
          toast({ title: dialogMode === 'edit' ? 'Вопрос обновлён' : 'Вопрос создан' });
          reload();
        }}
      />

      <QuestionPreviewDialog
        open={Boolean(previewId) && !dialogOpen}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
        bank="assessment"
        questionIds={previewQuestionIds}
        initialId={previewId}
        canDelete={previewQuestion ? canDeleteQuestion(previewQuestion) : false}
        onEdit={(question, mode = 'edit') => {
          openEdit(question, mode);
        }}
        onRequestDelete={(detail) => {
          setPreviewId(null);
          setConfirmAction({ type: 'delete', question: detail });
        }}
        onCopied={() => {
          reload();
        }}
        onOpenExamCreate={(questionId) => {
          setExamPrefillQuestionId(questionId);
          setExamCreateOpen(true);
        }}
      />

      <ExamCreateDialog
        open={examCreateOpen}
        onOpenChange={(open) => {
          setExamCreateOpen(open);
          if (!open) setExamPrefillQuestionId(null);
        }}
        prefillQuestionId={examPrefillQuestionId}
        onCreated={(created) => {
          toast({ title: 'Экзамен создан' });
          if (created?.id) {
            navigate(`${createPageUrl('AssessmentExamDetail')}?id=${created.id}`);
          }
        }}
      />

      <ReadingTaskEditor
        open={taskDialogOpen && taskDialogType === 'reading'}
        onOpenChange={(open) => {
          if (!open) closeTaskDialog();
        }}
        editing={editingTask}
        onSaved={() => {
          toast({ title: editingTask ? 'Задача обновлена' : 'Задача создана' });
          void loadSectionTasks();
        }}
      />

      <ListeningTaskEditor
        open={taskDialogOpen && taskDialogType === 'listening'}
        onOpenChange={(open) => {
          if (!open) closeTaskDialog();
        }}
        editing={editingTask}
        onSaved={() => {
          toast({ title: editingTask ? 'Задача обновлена' : 'Задача создана' });
          void loadSectionTasks();
        }}
      />

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmCopy[confirmAction?.type]?.title || 'Подтвердите действие'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCopy[confirmAction?.type]?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={!!busyId} onClick={runLifecycle}>
              {busyId
                ? 'Выполнение…'
                : confirmCopy[confirmAction?.type]?.confirmLabel || 'Подтвердить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuestionCardRow({ q, busyId, canDelete, onPreview, onEdit, onConfirm, authorName, showAuthor }) {
  return (
    <article
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-5"
      data-testid={`question-row-${q.id}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs rounded-full px-2 py-0.5 bg-brand-soft dark:bg-brand-soft/40 text-brand">
              {QUESTION_TYPE_LABEL[q.type] || q.type}
            </span>
            <LifecycleBadge status={q.status} />
            {showAuthor && authorName ? (
              <span className="text-xs text-slate-500">Автор: {authorName}</span>
            ) : null}
          </div>
          <p className="text-sm sm:text-base text-slate-900 dark:text-white line-clamp-3 whitespace-pre-wrap">
            {q.stem}
          </p>
          <p className="text-xs text-slate-400">
            {q.points != null ? `${q.points} балл(ов) · ` : ''}
            Сложность {q.difficulty ?? '—'} · Создан: {formatDateTime(q.created_at)} · Обновлён:{' '}
            {formatDateTime(q.updated_at || q.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busyId === q.id}
            onClick={() => onPreview?.(q.id)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Просмотр
          </Button>
          {q.status !== 'archived' ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyId === q.id}
                data-testid={`question-edit-${q.id}`}
                onClick={() => onEdit(q, 'edit')}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Изменить
              </Button>
              {q.status === 'draft' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === q.id}
                  onClick={() => onConfirm({ type: 'publish', question: q })}
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  Опубликовать
                </Button>
              )}
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(q, 'edit')}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Архив
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-rose-600"
              disabled={busyId === q.id}
              onClick={() => onConfirm({ type: 'delete', question: q })}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Удалить
            </Button>
          )}
          {q.status !== 'archived' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyId === q.id}
              onClick={() => onConfirm({ type: 'archive', question: q })}
            >
              <Archive className="h-3.5 w-3.5 mr-1" />
              В архив
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
