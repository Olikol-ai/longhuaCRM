import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Plus, Save, CheckCircle2, Trash2 } from 'lucide-react';
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
  { value: 'reading', label: 'Reading' },
  { value: 'listening', label: 'Listening' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'writing', label: 'Writing (текст)' },
];

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

export default function HomeworkEditor() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id');
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [libraryQuestions, setLibraryQuestions] = useState([]);
  const [libraryReading, setLibraryReading] = useState([]);
  const [libraryListening, setLibraryListening] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '',
    activity_kind: 'test',
    pass_score_percent: 60,
    tasks: [emptyTask('question')],
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
        setLibraryReading(r.filter((t) => t.status === 'published'));
        setLibraryListening(l.filter((t) => t.status === 'published'));
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
      return;
    }
    (async () => {
      try {
        const hw = await api.homework.get(id);
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
      } catch (err) {
        toast({
          title: 'Ошибка загрузки',
          description: userFacingError(err),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const filteredLibraryQuestions = libraryQuestions.filter((q) => {
    if (form.activity_kind === 'speaking') return q.type === 'speaking';
    if (form.activity_kind === 'writing') {
      return q.type === 'short_text' || q.type === 'translation';
    }
    if (form.activity_kind === 'test') {
      return !isManualReviewQuestionType(q.type) || q.type === 'short_text' || q.type === 'translation' || q.type === 'speaking';
    }
    return true;
  });

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
          description: 'Выберите тест-вопрос',
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
      navigate(createPageUrl('HomeworkList'));
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

  const listeningOptions = libraryListening;
  const readingOptions = libraryReading;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6" data-testid="homework-editor">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {id ? 'Редактирование задания' : 'Новое домашнее задание'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Соберите задание из тест-вопросов, аудирования и чтения из вашей библиотеки.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Название</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg"
            data-testid="homework-title"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Описание</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 text-sm border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Инструкция</label>
          <textarea
            value={form.instructions}
            onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            rows={4}
            placeholder={'Прочитайте текст.\nПрослушайте аудио.\nОтветьте на вопросы.'}
            className="w-full px-3 py-2 text-sm border rounded-lg"
            data-testid="homework-instructions"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Тип задания</label>
            <select
              value={form.activity_kind}
              onChange={(e) => setForm((f) => ({ ...f, activity_kind: e.target.value }))}
              className="w-full px-3 py-2 text-sm border rounded-lg"
            >
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Проходной %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.pass_score_percent}
              onChange={(e) => setForm((f) => ({ ...f, pass_score_percent: e.target.value }))}
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Состав ({form.tasks.length})</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addTask('question')}>
              <Plus className="h-4 w-4 mr-1" />
              Добавить тест
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addTask('listening')}>
              <Plus className="h-4 w-4 mr-1" />
              Аудирование
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addTask('reading')}>
              <Plus className="h-4 w-4 mr-1" />
              Чтение
            </Button>
          </div>
        </div>

        {form.tasks.map((task, index) => (
          <div
            key={task.localKey}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-3"
            data-testid={`homework-question-${index}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {task.task_kind === 'question'
                  ? 'Тест-вопрос'
                  : CONTENT_TASK_TYPE_LABEL[task.task_kind] || task.task_kind}{' '}
                #{index + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-rose-600"
                disabled={form.tasks.length <= 1}
                onClick={() => removeTask(task.localKey)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Удалить
              </Button>
            </div>

            {task.task_kind === 'question' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Вопрос</label>
                <select
                  value={task.question_id}
                  onChange={(e) => updateTask(task.localKey, { question_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                >
                  <option value="">Выберите…</option>
                  {filteredLibraryQuestions.map((q) => (
                    <option key={q.id} value={q.id}>
                      [{QUESTION_TYPE_LABEL[q.type] || q.type}] {q.stem.slice(0, 80)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
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
                  className="w-full px-3 py-2 text-sm border rounded-lg"
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

            <div>
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

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(createPageUrl('HomeworkList'))}>
          Отмена
        </Button>
        <Button disabled={saving} onClick={() => handleSave(false)} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить
        </Button>
        <Button disabled={saving} onClick={() => handleSave(true)} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Сохранить и опубликовать
        </Button>
      </div>
    </div>
  );
}
