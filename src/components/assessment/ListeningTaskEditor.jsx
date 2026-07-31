import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  QUESTION_TYPE_LABEL,
  QUESTION_TYPES,
  needsAnswerOptions,
} from '@/lib/assessment-admin';
import TaskVocabularyEditor, {
  mapVocabularyFromApi,
  mapVocabularyToApi,
} from './TaskVocabularyEditor';

function emptyAnswer(sortOrder = 0) {
  return { text: '', is_correct: false, sort_order: sortOrder };
}

function emptyQuestion() {
  return {
    localKey: `q-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'single_choice',
    stem: '',
    points: '1',
    explanation: '',
    answers: [emptyAnswer(0), emptyAnswer(1)],
  };
}

/**
 * ListeningTask editor: audio on task + inline nested questions (not from the Test bank).
 */
export default function ListeningTaskEditor({ open, onOpenChange, editing = null, onSaved }) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [levelLabel, setLevelLabel] = useState('');
  const [vocabulary, setVocabulary] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAudioFile(null);
    setLoadingMeta(true);
    const load = async () => {
      try {
        if (editing?.id) {
          const detail = await api.assessment.getListeningTask(editing.id);
          setTitle(detail.title || '');
          setInstructions(detail.instructions || '');
          setLevelLabel(detail.level_label || '');
          setVocabulary(mapVocabularyFromApi(detail.vocabulary));
          setHasAudio(Boolean(detail.has_audio));
          const nested = (detail.questions || []).map((q, i) => ({
            localKey: q.id || `q-${i}`,
            type: q.type || 'single_choice',
            stem: q.stem || '',
            points: String(q.points ?? 1),
            explanation: q.explanation || '',
            answers: (q.answers || []).length
              ? q.answers.map((a, ai) => ({
                  text: a.text || '',
                  is_correct: Boolean(a.is_correct),
                  sort_order: a.sort_order ?? ai,
                }))
              : [emptyAnswer(0), emptyAnswer(1)],
          }));
          setQuestions(nested.length ? nested : [emptyQuestion()]);
        } else {
          setTitle('');
          setInstructions('');
          setLevelLabel('');
          setVocabulary([]);
          setHasAudio(false);
          setQuestions([emptyQuestion()]);
        }
      } catch (err) {
        setError(err?.message || 'Не удалось загрузить задачу');
      } finally {
        setLoadingMeta(false);
      }
    };
    void load();
  }, [open, editing?.id]);

  const updateQuestion = (localKey, patch) => {
    setQuestions((prev) =>
      prev.map((q) => (q.localKey === localKey ? { ...q, ...patch } : q)),
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Укажите название');
      return;
    }
    if (!editing && !audioFile) {
      setError('Загрузите аудиофайл');
      return;
    }
    if (questions.length < 1) {
      setError('Добавьте хотя бы один вопрос');
      return;
    }
    for (const [i, q] of questions.entries()) {
      if (!q.stem.trim()) {
        setError(`Вопрос ${i + 1}: укажите формулировку`);
        return;
      }
      if (needsAnswerOptions(q.type)) {
        const filled = (q.answers || []).filter((a) => a.text.trim());
        if (filled.length < 2) {
          setError(`Вопрос ${i + 1}: нужно минимум 2 варианта`);
          return;
        }
        if (!filled.some((a) => a.is_correct)) {
          setError(`Вопрос ${i + 1}: отметьте правильный ответ`);
          return;
        }
      }
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: title.trim(),
      instructions: instructions.trim() || null,
      level_label: levelLabel.trim() || null,
      vocabulary: mapVocabularyToApi(vocabulary),
      questions: questions.map((q) => ({
        type: q.type,
        stem: q.stem.trim(),
        points: Number(q.points) || 1,
        explanation: q.explanation.trim() || null,
        answers: needsAnswerOptions(q.type)
          ? q.answers
              .filter((a) => a.text.trim())
              .map((a, i) => ({
                text: a.text.trim(),
                is_correct: Boolean(a.is_correct),
                sort_order: i,
              }))
          : [],
      })),
    };
    try {
      let saved = editing?.id
        ? await api.assessment.updateListeningTask(editing.id, payload)
        : await api.assessment.createListeningTask(payload);
      if (audioFile) {
        saved = await api.assessment.uploadListeningTaskAudio(saved.id, audioFile);
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Редактировать аудирование' : 'Создать аудирование'}
          </DialogTitle>
        </DialogHeader>

        {loadingMeta ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Название</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Диалог в магазине"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Аудиофайл</Label>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
              {hasAudio && !audioFile ? (
                <p className="text-xs text-slate-500">Аудио уже загружено</p>
              ) : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Описание задания (необяз.)</Label>
                <Input
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Прослушайте аудио и ответьте на вопросы"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Уровень (необяз.)</Label>
                <Input
                  value={levelLabel}
                  onChange={(e) => setLevelLabel(e.target.value)}
                  placeholder="HSK 2"
                />
              </div>
            </div>

            <TaskVocabularyEditor items={vocabulary} onChange={setVocabulary} />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Вопросы к аудио</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Добавить вопрос
                </Button>
              </div>
              {questions.map((q, index) => (
                <NestedQuestionBlock
                  key={q.localKey}
                  index={index}
                  question={q}
                  canRemove={questions.length > 1}
                  onChange={(patch) => updateQuestion(q.localKey, patch)}
                  onRemove={() =>
                    setQuestions((prev) => prev.filter((x) => x.localKey !== q.localKey))
                  }
                />
              ))}
            </div>

            {error && (
              <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingMeta}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение…
              </>
            ) : (
              'Сохранить'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NestedQuestionBlock({ index, question, canRemove, onChange, onRemove }) {
  const showAnswers = needsAnswerOptions(question.type);
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Вопрос {index + 1}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Тип</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={question.type}
            onChange={(e) => onChange({ type: e.target.value })}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABEL[t] || t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Баллы</Label>
          <Input
            type="number"
            min={0}
            value={question.points}
            onChange={(e) => onChange({ points: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Формулировка</Label>
        <Textarea
          rows={2}
          value={question.stem}
          onChange={(e) => onChange({ stem: e.target.value })}
        />
      </div>
      {showAnswers && (
        <div className="space-y-1">
          <Label className="text-xs">Варианты</Label>
          {(question.answers || []).map((a, ai) => (
            <div key={ai} className="flex items-center gap-2">
              <input
                type={question.type === 'multiple_choice' ? 'checkbox' : 'radio'}
                name={`correct-${question.localKey}`}
                checked={Boolean(a.is_correct)}
                onChange={() => {
                  const next = question.answers.map((row, ri) => ({
                    ...row,
                    is_correct:
                      question.type === 'multiple_choice'
                        ? ri === ai
                          ? !row.is_correct
                          : row.is_correct
                        : ri === ai,
                  }));
                  onChange({ answers: next });
                }}
              />
              <Input
                value={a.text}
                onChange={(e) => {
                  const next = question.answers.map((row, ri) =>
                    ri === ai ? { ...row, text: e.target.value } : row,
                  );
                  onChange({ answers: next });
                }}
                placeholder={`Вариант ${ai + 1}`}
              />
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({
                answers: [...question.answers, emptyAnswer(question.answers.length)],
              })
            }
          >
            + вариант
          </Button>
        </div>
      )}
    </div>
  );
}
