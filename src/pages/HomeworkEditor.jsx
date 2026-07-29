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
  QUESTION_TYPE_LABEL,
  needsAnswerOptions,
  validateQuestionForm,
} from '@/lib/assessment-admin';

const ACTIVITY_OPTIONS = [
  { value: 'test', label: 'Тест' },
  { value: 'reading', label: 'Reading' },
  { value: 'listening', label: 'Listening' },
  { value: 'speaking', label: 'Speaking (скоро)' },
  { value: 'writing', label: 'Writing (скоро)' },
];

const HOMEWORK_QUESTION_TYPES = [
  'single_choice',
  'multiple_choice',
  'short_text',
  'translation',
  'reading',
  'listening',
];

const HOMEWORK_TYPE_LABEL = {
  ...QUESTION_TYPE_LABEL,
  translation: 'Перевод',
  reading: 'Reading',
};

function emptyAnswer(sortOrder = 0) {
  return { text: '', is_correct: false, sort_order: sortOrder };
}

function emptyQuestion(sortOrder = 0) {
  return {
    localKey: `q-${Date.now()}-${sortOrder}`,
    type: 'single_choice',
    stem: '',
    points: 1,
    difficulty: 1,
    explanation: '',
    passage_text: '',
    section_key: 'test',
    sort_order: sortOrder,
    answers: [emptyAnswer(0), emptyAnswer(1)],
  };
}

function itemNeedsOptions(type) {
  return needsAnswerOptions(type);
}

export default function HomeworkEditor() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id');
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '',
    activity_kind: 'test',
    pass_score_percent: 60,
    items: [emptyQuestion(0)],
  });

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const hw = await api.homework.get(id);
        const items = (hw.items || []).map((item, idx) => ({
          localKey: item.id || `existing-${idx}`,
          type: item.type || 'single_choice',
          stem: item.stem || '',
          points: item.points ?? 1,
          difficulty: item.difficulty ?? 1,
          explanation: item.explanation || '',
          passage_text: item.passage_text || '',
          section_key: item.section_key || 'test',
          sort_order: item.sort_order ?? idx,
          answers:
            Array.isArray(item.answers) && item.answers.length > 0
              ? item.answers.map((answer, answerIdx) => ({
                  text: answer.text || answer.body || '',
                  is_correct: Boolean(answer.is_correct),
                  sort_order: answer.sort_order ?? answerIdx,
                }))
              : [emptyAnswer(0), emptyAnswer(1)],
        }));
        setForm({
          title: hw.title || '',
          description: hw.description || '',
          instructions: hw.instructions || '',
          activity_kind: hw.activity_kind || 'test',
          pass_score_percent: hw.pass_score_percent ?? 60,
          items: items.length > 0 ? items : [emptyQuestion(0)],
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

  const updateItem = (localKey, patch) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.localKey === localKey ? { ...item, ...patch } : item,
      ),
    }));
  };

  const updateAnswer = (localKey, answerIndex, patch) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.localKey !== localKey) return item;
        const answers = item.answers.map((answer, idx) => {
          if (idx !== answerIndex) {
            if (
              patch.is_correct &&
              (item.type === 'single_choice' ||
                item.type === 'listening' ||
                item.type === 'reading')
            ) {
              return { ...answer, is_correct: false };
            }
            return answer;
          }
          return { ...answer, ...patch };
        });
        return { ...item, answers };
      }),
    }));
  };

  const addQuestion = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyQuestion(prev.items.length)],
    }));
  };

  const removeQuestion = (localKey) => {
    setForm((prev) => ({
      ...prev,
      items:
        prev.items.length <= 1
          ? prev.items
          : prev.items
              .filter((item) => item.localKey !== localKey)
              .map((item, idx) => ({ ...item, sort_order: idx })),
    }));
  };

  const addAnswer = (localKey) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.localKey === localKey
          ? {
              ...item,
              answers: [...item.answers, emptyAnswer(item.answers.length)],
            }
          : item,
      ),
    }));
  };

  const removeAnswer = (localKey, answerIndex) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.localKey !== localKey || item.answers.length <= 2) return item;
        return {
          ...item,
          answers: item.answers
            .filter((_, idx) => idx !== answerIndex)
            .map((answer, idx) => ({ ...answer, sort_order: idx })),
        };
      }),
    }));
  };

  const buildPayloadItems = () =>
    form.items.map((item, idx) => {
      const showOptions = itemNeedsOptions(item.type);
      return {
        type: item.type,
        stem: item.stem.trim(),
        points: Number(item.points) || 1,
        difficulty: Math.min(5, Math.max(1, Number(item.difficulty) || 1)),
        explanation: item.explanation.trim() || undefined,
        passage_text: item.passage_text.trim() || undefined,
        section_key:
          item.type === 'listening'
            ? 'listening'
            : item.type === 'reading'
              ? 'reading'
              : form.activity_kind === 'listening'
                ? 'listening'
                : form.activity_kind === 'reading'
                  ? 'reading'
                  : 'test',
        sort_order: idx,
        answers: showOptions
          ? item.answers
              .filter((answer) => answer.text.trim())
              .map((answer, answerIdx) => ({
                text: answer.text.trim(),
                is_correct: Boolean(answer.is_correct),
                sort_order: answerIdx,
              }))
          : [],
      };
    });

  const handleSave = async (publishAfter = false) => {
    if (!form.title.trim() || form.title.trim().length < 2) {
      toast({ title: 'Укажите название', variant: 'destructive' });
      return;
    }
    if (form.items.length < 1) {
      toast({ title: 'Добавьте хотя бы один вопрос', variant: 'destructive' });
      return;
    }
    for (const [index, item] of form.items.entries()) {
      const error = validateQuestionForm({
        type: itemNeedsOptions(item.type) ? item.type : 'short_text',
        stem: item.stem,
        answers: itemNeedsOptions(item.type)
          ? item.answers.map((answer) => ({
              text: answer.text,
              is_correct: answer.is_correct,
            }))
          : [],
      });
      if (error) {
        toast({
          title: `Вопрос ${index + 1}`,
          description: error,
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
        items: buildPayloadItems(),
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6" data-testid="homework-editor">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {id ? 'Редактирование задания' : 'Новое домашнее задание'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Создавайте вопросы прямо внутри задания. Банк вопросов и блоки экзаменов не нужны.
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
                <option
                  key={o.value}
                  value={o.value}
                  disabled={o.value === 'speaking' || o.value === 'writing'}
                >
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Вопросы ({form.items.length})</h2>
          <Button type="button" variant="outline" size="sm" onClick={addQuestion} className="gap-1">
            <Plus className="h-4 w-4" />
            Добавить вопрос
          </Button>
        </div>

        {form.items.map((item, index) => {
          const showOptions = itemNeedsOptions(item.type);
          return (
            <div
              key={item.localKey}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-3"
              data-testid={`homework-question-${index}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Вопрос {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-rose-600"
                  disabled={form.items.length <= 1}
                  onClick={() => removeQuestion(item.localKey)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Удалить
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Тип</label>
                  <select
                    value={item.type}
                    onChange={(e) => updateItem(item.localKey, { type: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                  >
                    {HOMEWORK_QUESTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {HOMEWORK_TYPE_LABEL[type] || type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Баллы</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={item.points}
                    onChange={(e) => updateItem(item.localKey, { points: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Сложность</label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={item.difficulty}
                    onChange={(e) => updateItem(item.localKey, { difficulty: e.target.value })}
                  />
                </div>
              </div>

              {(item.type === 'reading' || form.activity_kind === 'reading') && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Текст для Reading
                  </label>
                  <Textarea
                    rows={3}
                    value={item.passage_text}
                    onChange={(e) => updateItem(item.localKey, { passage_text: e.target.value })}
                    placeholder="Вставьте текст для чтения…"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Текст вопроса
                </label>
                <Textarea
                  rows={2}
                  value={item.stem}
                  onChange={(e) => updateItem(item.localKey, { stem: e.target.value })}
                  placeholder="Введите формулировку…"
                />
              </div>

              {showOptions ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600">Варианты ответа</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addAnswer(item.localKey)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Вариант
                    </Button>
                  </div>
                  {item.answers.map((answer, answerIndex) => (
                    <div key={answerIndex} className="flex items-start gap-2">
                      <input
                        type={item.type === 'multiple_choice' ? 'checkbox' : 'radio'}
                        name={`correct-${item.localKey}`}
                        className="mt-2.5 accent-brand"
                        checked={Boolean(answer.is_correct)}
                        onChange={(e) =>
                          updateAnswer(item.localKey, answerIndex, {
                            is_correct: e.target.checked,
                          })
                        }
                        title="Правильный ответ"
                      />
                      <Input
                        className="flex-1"
                        value={answer.text}
                        onChange={(e) =>
                          updateAnswer(item.localKey, answerIndex, { text: e.target.value })
                        }
                        placeholder={`Вариант ${answerIndex + 1}`}
                      />
                      {item.answers.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAnswer(item.localKey, answerIndex)}
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Ученик введёт ответ текстом. Проверка — вручную преподавателем.
                </p>
              )}
            </div>
          );
        })}
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
