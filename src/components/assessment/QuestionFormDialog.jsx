import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
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
  ATTACHMENT_KIND_LABEL,
  QUESTION_TYPE_LABEL,
  QUESTION_TYPES,
  guessAttachmentKind,
  needsAnswerOptions,
  validateQuestionForm,
} from '@/lib/assessment-admin';

function emptyAnswer(sortOrder = 0) {
  return { text: '', is_correct: false, sort_order: sortOrder };
}

export default function QuestionFormDialog({
  open,
  onOpenChange,
  mode = 'create',
  question = null,
  onSaved,
}) {
  const editing = mode === 'edit';
  const readOnly = editing && question?.status !== 'draft';

  const [type, setType] = useState('single_choice');
  const [stem, setStem] = useState('');
  const [points, setPoints] = useState('1');
  const [difficulty, setDifficulty] = useState('1');
  const [explanation, setExplanation] = useState('');
  const [answers, setAnswers] = useState([emptyAnswer(0), emptyAnswer(1)]);
  const [attachments, setAttachments] = useState([]);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingKind, setPendingKind] = useState('audio');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const hydrate = async () => {
      setError(null);
      setSaving(false);
      setPendingFile(null);

      if (editing && question?.id) {
        setLoadingDetail(true);
        try {
          const detail = await api.assessment.getQuestion(question.id);
          if (cancelled) return;
          setType(detail.type || 'single_choice');
          setStem(detail.stem || '');
          setPoints(String(detail.points ?? '1'));
          setDifficulty(String(detail.difficulty ?? '1'));
          setExplanation(detail.explanation || '');
          const opts = (detail.answers || [])
            .slice()
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((a, i) => ({
              text: a.text || '',
              is_correct: Boolean(a.is_correct),
              sort_order: a.sort_order ?? i,
            }));
          setAnswers(opts.length >= 2 ? opts : [emptyAnswer(0), emptyAnswer(1)]);
          setAttachments(Array.isArray(detail.attachments) ? detail.attachments : []);
        } catch (err) {
          if (!cancelled) setError(err?.message || 'Не удалось загрузить вопрос');
        } finally {
          if (!cancelled) setLoadingDetail(false);
        }
        return;
      }

      setType('single_choice');
      setStem('');
      setPoints('1');
      setDifficulty('1');
      setExplanation('');
      setAnswers([emptyAnswer(0), emptyAnswer(1)]);
      setAttachments([]);
      setLoadingDetail(false);
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [open, editing, question]);

  const showAnswers = needsAnswerOptions(type);

  const setAnswerField = (index, key, value) => {
    setAnswers((prev) =>
      prev.map((row, i) => {
        if (i !== index) {
          if (key === 'is_correct' && value && (type === 'single_choice' || type === 'listening')) {
            return { ...row, is_correct: false };
          }
          return row;
        }
        return { ...row, [key]: value };
      }),
    );
  };

  const addAnswer = () => {
    setAnswers((prev) => [...prev, emptyAnswer(prev.length)]);
  };

  const removeAnswer = (index) => {
    setAnswers((prev) => prev.filter((_, i) => i !== index).map((a, i) => ({ ...a, sort_order: i })));
  };

  const payloadAnswers = useMemo(() => {
    if (!showAnswers) return [];
    return answers
      .filter((a) => a.text.trim())
      .map((a, i) => ({
        text: a.text.trim(),
        is_correct: Boolean(a.is_correct),
        sort_order: i,
      }));
  }, [answers, showAnswers]);

  const handleSave = async () => {
    if (readOnly) {
      onOpenChange(false);
      return;
    }
    const validationError = validateQuestionForm({
      type,
      stem,
      answers: payloadAnswers,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body = {
        type,
        stem: stem.trim(),
        points: Number(points) || 1,
        difficulty: Math.min(5, Math.max(1, Number(difficulty) || 1)),
        explanation: explanation.trim() || null,
        answers: showAnswers ? payloadAnswers : [],
      };

      let saved;
      if (editing) {
        saved = await api.assessment.updateQuestion(question.id, body);
      } else {
        saved = await api.assessment.createQuestion(body);
      }

      if (pendingFile && saved?.id) {
        setUploading(true);
        try {
          await api.assessment.uploadQuestionAttachment(saved.id, {
            file: pendingFile,
            kind: pendingKind || guessAttachmentKind(pendingFile),
          });
        } catch (uploadErr) {
          setError(
            `Вопрос сохранён, но вложение не загрузилось: ${uploadErr?.message || 'ошибка'}`,
          );
          onSaved?.(saved);
          return;
        } finally {
          setUploading(false);
        }
      }

      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить вопрос');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadExisting = async () => {
    if (!editing || !question?.id || !pendingFile || readOnly) return;
    setUploading(true);
    setError(null);
    try {
      const att = await api.assessment.uploadQuestionAttachment(question.id, {
        file: pendingFile,
        kind: pendingKind || guessAttachmentKind(pendingFile),
      });
      setAttachments((prev) => [...prev, att]);
      setPendingFile(null);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить вложение');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!question?.id || readOnly) return;
    setUploading(true);
    try {
      await api.assessment.deleteQuestionAttachment(question.id, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      setError(err?.message || 'Не удалось удалить вложение');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? readOnly
                ? 'Просмотр вопроса'
                : 'Редактировать вопрос'
              : 'Новый вопрос'}
          </DialogTitle>
        </DialogHeader>

        {loadingDetail ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="q-type">Тип</Label>
                <select
                  id="q-type"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={readOnly}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {QUESTION_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-points">Баллы</Label>
                <Input
                  id="q-points"
                  type="number"
                  min="0"
                  step="0.5"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-diff">Сложность (1–5)</Label>
                <Input
                  id="q-diff"
                  type="number"
                  min="1"
                  max="5"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-stem">Текст вопроса</Label>
              <Textarea
                id="q-stem"
                rows={3}
                value={stem}
                onChange={(e) => setStem(e.target.value)}
                placeholder="Введите формулировку…"
                disabled={readOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-expl">Пояснение (необязательно)</Label>
              <Textarea
                id="q-expl"
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                disabled={readOnly}
              />
            </div>

            {showAnswers && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Варианты ответа</Label>
                  {!readOnly && (
                    <Button type="button" variant="outline" size="sm" onClick={addAnswer}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Вариант
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {answers.map((row, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5"
                    >
                      <input
                        type={
                          type === 'multiple_choice' ? 'checkbox' : 'radio'
                        }
                        name="correct-answer"
                        className="mt-2.5 accent-brand"
                        checked={Boolean(row.is_correct)}
                        onChange={(e) =>
                          setAnswerField(index, 'is_correct', e.target.checked)
                        }
                        disabled={readOnly}
                        title="Правильный ответ"
                      />
                      <Input
                        className="flex-1"
                        value={row.text}
                        onChange={(e) => setAnswerField(index, 'text', e.target.value)}
                        placeholder={`Вариант ${index + 1}`}
                        disabled={readOnly}
                      />
                      {!readOnly && answers.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAnswer(index)}
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Отметьте правильный ответ слева от варианта.
                </p>
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-3">
              <Label>Медиа-вложение</Label>
              {attachments.length > 0 && (
                <ul className="space-y-1.5">
                  {attachments.map((att) => (
                    <li
                      key={att.id}
                      className="flex items-center justify-between text-sm rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5"
                    >
                      <span>
                        {ATTACHMENT_KIND_LABEL[att.kind] || att.kind}
                        {att.original_filename ? ` — ${att.original_filename}` : ''}
                      </span>
                      {!readOnly && editing && (
                        <button
                          type="button"
                          className="text-rose-500 hover:text-rose-600"
                          onClick={() => handleDeleteAttachment(att.id)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!readOnly && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setPendingFile(file);
                      if (file) setPendingKind(guessAttachmentKind(file));
                    }}
                  />
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={pendingKind}
                    onChange={(e) => setPendingKind(e.target.value)}
                  >
                    {Object.entries(ATTACHMENT_KIND_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {editing && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!pendingFile || uploading}
                      onClick={handleUploadExisting}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1" />
                          Загрузить
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
              {!editing && pendingFile && (
                <p className="text-xs text-slate-500">
                  Файл будет загружен после создания вопроса: {pendingFile.name}
                </p>
              )}
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
            {readOnly ? 'Закрыть' : 'Отмена'}
          </Button>
          {!readOnly && (
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleSave}
              disabled={saving || loadingDetail || uploading}
            >
              {saving || uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение…
                </>
              ) : (
                'Сохранить'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
