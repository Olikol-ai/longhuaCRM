import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Plus, Save, CheckCircle2, Trash2, Send } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import {
  CONTENT_TASK_TYPE_LABEL,
  QUESTION_TYPE_LABEL,
  isManualReviewQuestionType,
  unwrapItems,
} from '@/lib/assessment-admin';

const ACTIVITY_OPTIONS = [
  { value: 'test', label: 'Тест' },
  { value: 'reading', label: 'Чтение' },
  { value: 'listening', label: 'Аудирование' },
  { value: 'speaking', label: 'Говорение' },
  { value: 'writing', label: 'Письмо' },
];

const fieldClass =
  'w-full min-h-11 h-11 px-3 text-base border rounded-lg bg-background md:min-h-9 md:h-9 md:text-sm';

function emptyTask(kind = 'question') {
  return {
    localKey: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    task_kind: kind,
    question_id: '',
    reading_task_id: '',
    listening_task_id: '',
    points: '',
  };
}

function mergeById(primary, extra) {
  const map = new Map();
  for (const row of [...extra, ...primary]) {
    if (row?.id) map.set(row.id, row);
  }
  return [...map.values()];
}

export default function HomeworkEditor() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id');
  const prefillQuestionId = params.get('questionId');
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [libraryQuestions, setLibraryQuestions] = useState([]);
  const [libraryReading, setLibraryReading] = useState([]);
  const [libraryListening, setLibraryListening] = useState([]);
  const [linkedQuestions, setLinkedQuestions] = useState([]);
  const [linkedReading, setLinkedReading] = useState([]);
  const [linkedListening, setLinkedListening] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '',
    activity_kind: 'test',
    pass_score_percent: 60,
    tasks: [
      prefillQuestionId && !id
        ? { ...emptyTask('question'), question_id: prefillQuestionId }
        : emptyTask('question'),
    ],
  });

  useEffect(() => {
    Promise.all([
      api.assessment.listQuestions({ status: 'published', limit: 500 }),
      api.assessment.listReadingTasks(),
      api.assessment.listListeningTasks(),
    ])
      .then(([qs, reading, listening]) => {
        setLibraryQuestions(unwrapItems(qs));
        const r = Array.isArray(reading) ? reading : unwrapItems(reading);
        const l = Array.isArray(listening) ? listening : unwrapItems(listening);
        setLibraryReading(r.filter((t) => t.status === 'published' || t.status === 'draft'));
        setLibraryListening(l.filter((t) => t.status === 'published' || t.status === 'draft'));
      })
      .catch(() => {
        setLibraryQuestions([]);
        setLibraryReading([]);
        setLibraryListening([]);
      });
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const hw = await api.homework.get(id);
        if (cancelled) return;
        const tasks = (hw.tasks || []).map((task, idx) => ({
          localKey: task.id || `existing-${idx}`,
          task_kind: task.task_kind,
          question_id: task.question_id || '',
          reading_task_id: task.reading_task_id || '',
          listening_task_id: task.listening_task_id || '',
          points: task.points ?? '',
        }));
        setForm({
          title: hw.title || '',
          description: hw.description || '',
          instructions: hw.instructions || '',
          activity_kind: hw.activity_kind || 'test',
          pass_score_percent: hw.pass_score_percent ?? 60,
          tasks: tasks.length > 0 ? tasks : [emptyTask('question')],
        });
        // Ensure currently linked items appear in selects even if filtered out of library
        // (other author, archived, activity filter mismatch).
        setLinkedQuestions(
          (hw.tasks || [])
            .filter((t) => t.task_kind === 'question' && t.question)
            .map((t) => ({
              id: t.question.id,
              type: t.question.type,
              stem: t.question.stem,
              status: 'published',
            })),
        );
        setLinkedReading(
          (hw.tasks || [])
            .filter((t) => t.task_kind === 'reading' && t.reading_task)
            .map((t) => ({
              id: t.reading_task.id,
              title: t.reading_task.title,
              status: t.reading_task.status || 'published',
              questions: [],
            })),
        );
        setLinkedListening(
          (hw.tasks || [])
            .filter((t) => t.task_kind === 'listening' && t.listening_task)
            .map((t) => ({
              id: t.listening_task.id,
              title: t.listening_task.title,
              status: t.listening_task.status || 'published',
              questions: [],
            })),
        );
      } catch (err) {
        if (cancelled) return;
        const message = userFacingError(err);
        setLoadError(message);
        toast({
          title: 'Не удалось открыть задание',
          description: message,
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const questionOptions = useMemo(() => {
    const merged = mergeById(libraryQuestions, linkedQuestions);
    return merged.filter((q) => {
      if (form.activity_kind === 'speaking') return q.type === 'speaking';
      if (form.activity_kind === 'writing') {
        return q.type === 'short_text' || q.type === 'translation';
      }
      if (form.activity_kind === 'test') {
        return (
          !isManualReviewQuestionType(q.type) ||
          q.type === 'short_text' ||
          q.type === 'translation' ||
          q.type === 'speaking'
        );
      }
      return true;
    });
  }, [libraryQuestions, linkedQuestions, form.activity_kind]);

  const readingOptions = useMemo(
    () => mergeById(libraryReading.filter((t) => t.status === 'published'), linkedReading),
    [libraryReading, linkedReading],
  );

  const listeningOptions = useMemo(
    () => mergeById(libraryListening.filter((t) => t.status === 'published'), linkedListening),
    [libraryListening, linkedListening],
  );

  const updateTask = (localKey, patch) => {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.localKey === localKey ? { ...task, ...patch } : task,
      ),
    }));
  };

  const addTask = (kind) => {
    setForm((prev) => ({
      ...prev,
      tasks: [...prev.tasks, emptyTask(kind)],
    }));
  };

  const removeTask = (localKey) => {
    setForm((prev) => ({
      ...prev,
      tasks:
        prev.tasks.length <= 1
          ? prev.tasks
          : prev.tasks.filter((task) => task.localKey !== localKey),
    }));
  };

  const buildPayloadTasks = () =>
    form.tasks.map((task, idx) => {
      if (task.task_kind === 'question') {
        return {
          task_kind: 'question',
          question_id: task.question_id,
          sort_order: idx,
          points: task.points !== '' ? Number(task.points) : undefined,
        };
      }
      if (task.task_kind === 'reading') {
        return {
          task_kind: 'reading',
          reading_task_id: task.reading_task_id,
          sort_order: idx,
          points: task.points !== '' ? Number(task.points) : undefined,
        };
      }
      return {
        task_kind: 'listening',
        listening_task_id: task.listening_task_id,
        sort_order: idx,
        points: task.points !== '' ? Number(task.points) : undefined,
      };
    });

  const handleSave = async (publishAfter = false) => {
    if (!form.title.trim() || form.title.trim().length < 2) {
      toast({ title: 'Укажите название', variant: 'destructive' });
      return;
    }
    if (form.tasks.length < 1) {
      toast({ title: 'Добавьте хотя бы одну задачу', variant: 'destructive' });
      return;
    }
    for (const [index, task] of form.tasks.entries()) {
      if (task.task_kind === 'question' && !task.question_id) {
        toast({
          title: `Задача ${index + 1}`,
          description: 'Выберите вопрос',
          variant: 'destructive',
        });
        return;
      }
      if (task.task_kind === 'reading' && !task.reading_task_id) {
        toast({
          title: `Задача ${index + 1}`,
          description: 'Выберите задачу чтения',
          variant: 'destructive',
        });
        return;
      }
      if (task.task_kind === 'listening' && !task.listening_task_id) {
        toast({
          title: `Задача ${index + 1}`,
          description: 'Выберите задачу аудирования',
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        instructions: form.instructions.trim() || undefined,
        activity_kind: form.activity_kind,
        pass_score_percent: Number(form.pass_score_percent) || 60,
        tasks: buildPayloadTasks(),
      };
      let hwId = id;
      if (id) {
        await api.homework.update(id, payload);
      } else {
        const created = await api.homework.create(payload);
        hwId = created.id;
      }
      if (publishAfter) {
        await api.homework.publish(hwId);
        toast({ title: 'Задание опубликовано' });
      } else {
        toast({ title: 'Сохранено' });
      }
      if (!id && hwId) {
        navigate(`${createPageUrl('HomeworkEditor')}?id=${encodeURIComponent(hwId)}`, {
          replace: true,
        });
      }
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (id && loadError) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4 text-center">
        <p className="text-slate-700 dark:text-slate-200 font-medium">Не удалось открыть задание</p>
        <p className="text-sm text-slate-500">{loadError}</p>
        <Button variant="outline" onClick={() => navigate(createPageUrl('HomeworkList'))}>
          К списку заданий
        </Button>
      </div>
    );
  }

  return (
    <div
      className="p-3 sm:p-6 lg:p-8 w-full max-w-3xl mx-auto space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden"
      data-testid="homework-editor"
    >
      <div className="min-w-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white break-words">
            {id ? 'Изменить домашнее задание' : 'Новое домашнее задание'}
          </h1>
          <p className="text-sm text-slate-500 mt-1 break-words">
            Название, описание, состав вопросов и настройки. Учеников и срок сдачи настройте при
            назначении.
          </p>
        </div>
        {id ? (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto shrink-0 gap-1.5"
            onClick={() =>
              navigate(`${createPageUrl('HomeworkAssignment')}?homeworkId=${encodeURIComponent(id)}`)
            }
          >
            <Send className="h-4 w-4" />
            Ученики и срок
          </Button>
        ) : null}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-5 space-y-4 min-w-0">
        <div className="min-w-0">
          <label className="block text-xs font-medium text-slate-600 mb-1">Название</label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            data-testid="homework-title"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium text-slate-600 mb-1">Описание</label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="min-h-[88px] text-base md:text-sm"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium text-slate-600 mb-1">Инструкция</label>
          <Textarea
            value={form.instructions}
            onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            rows={4}
            placeholder={'Прочитайте текст.\nПрослушайте аудио.\nОтветьте на вопросы.'}
            className="min-h-[120px] text-base md:text-sm"
            data-testid="homework-instructions"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="block text-xs font-medium text-slate-600 mb-1">Тип задания</label>
            <select
              value={form.activity_kind}
              onChange={(e) => setForm((f) => ({ ...f, activity_kind: e.target.value }))}
              className={fieldClass}
            >
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-slate-600 mb-1">Проходной %</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.pass_score_percent}
              onChange={(e) => setForm((f) => ({ ...f, pass_score_percent: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 min-w-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold">Состав ({form.tasks.length})</h2>
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => addTask('question')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Добавить тест
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => addTask('listening')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Аудирование
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => addTask('reading')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Чтение
            </Button>
          </div>
        </div>

        {form.tasks.map((task, index) => (
          <div
            key={task.localKey}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-5 space-y-3 min-w-0"
            data-testid={`homework-question-${index}`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium break-words min-w-0">
                {task.task_kind === 'question'
                  ? 'Тест-вопрос'
                  : CONTENT_TASK_TYPE_LABEL[task.task_kind] || task.task_kind}{' '}
                #{index + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-rose-600 self-start sm:self-auto"
                disabled={form.tasks.length <= 1}
                onClick={() => removeTask(task.localKey)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Удалить
              </Button>
            </div>

            {task.task_kind === 'question' ? (
              <div className="min-w-0">
                <label className="block text-xs font-medium text-slate-600 mb-1">Вопрос</label>
                <select
                  value={task.question_id}
                  onChange={(e) => updateTask(task.localKey, { question_id: e.target.value })}
                  className={`${fieldClass} max-w-full`}
                >
                  <option value="">Выберите…</option>
                  {questionOptions.map((q) => (
                    <option key={q.id} value={q.id}>
                      [{QUESTION_TYPE_LABEL[q.type] || q.type}] {(q.stem || '').slice(0, 80)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="min-w-0">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {CONTENT_TASK_TYPE_LABEL[task.task_kind]}
                </label>
                <select
                  value={
                    task.task_kind === 'listening'
                      ? task.listening_task_id
                      : task.reading_task_id
                  }
                  onChange={(e) =>
                    updateTask(
                      task.localKey,
                      task.task_kind === 'listening'
                        ? { listening_task_id: e.target.value }
                        : { reading_task_id: e.target.value },
                    )
                  }
                  className={`${fieldClass} max-w-full`}
                >
                  <option value="">Выберите…</option>
                  {(task.task_kind === 'listening' ? listeningOptions : readingOptions).map(
                    (t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({(t.questions || []).length} вопр.)
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}

            <div className="min-w-0 sm:max-w-xs">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Баллы (необязательно)
              </label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={task.points}
                onChange={(e) => updateTask(task.localKey, { points: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2 pb-2">
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => navigate(createPageUrl('HomeworkList'))}
        >
          К списку
        </Button>
        <Button
          disabled={saving}
          onClick={() => handleSave(false)}
          className="gap-2 w-full sm:w-auto"
          data-testid="homework-save"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить
        </Button>
        <Button
          disabled={saving}
          onClick={() => handleSave(true)}
          className="gap-2 w-full sm:w-auto"
        >
          <CheckCircle2 className="h-4 w-4" />
          Сохранить и опубликовать
        </Button>
      </div>
    </div>
  );
}
