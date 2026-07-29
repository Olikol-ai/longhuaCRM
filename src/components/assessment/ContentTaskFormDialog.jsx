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
import { CONTENT_TASK_TYPE_LABEL, QUESTION_TYPE_LABEL, unwrapItems } from '@/lib/assessment-admin';

/**
 * Create / edit Listening or Reading container with nested atomic questions.
 */
export default function ContentTaskFormDialog({
  open,
  onOpenChange,
  taskType = 'listening',
  editing = null,
  onSaved,
}) {
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [questionIds, setQuestionIds] = useState([]);
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
        const qs = await api.assessment.listQuestions({
          status: 'published',
          limit: 500,
        });
        setAvailableQuestions(unwrapItems(qs));
        if (editing?.id) {
          const detail = await api.assessment.getContentTask(editing.id);
          setTitle(detail.title || '');
          setTextContent(detail.text_content || '');
          setHasAudio(Boolean(detail.audio_attachment_id));
          setQuestionIds((detail.questions || []).map((q) => q.question_id).filter(Boolean));
        } else {
          setTitle('');
          setTextContent('');
          setHasAudio(false);
          setQuestionIds([]);
        }
      } catch (err) {
        setError(err?.message || 'Не удалось загрузить данные');
      } finally {
        setLoadingMeta(false);
      }
    };
    void load();
  }, [open, editing?.id]);

  const toggleQuestion = (id) => {
    setQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Укажите название');
      return;
    }
    if (taskType === 'reading' && !textContent.trim() && !editing) {
      setError('Для чтения нужен текст');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let saved;
      if (editing?.id) {
        saved = await api.assessment.updateContentTask(editing.id, {
          title: title.trim(),
          text_content: taskType === 'reading' ? textContent : undefined,
          question_ids: questionIds,
        });
      } else {
        saved = await api.assessment.createContentTask({
          task_type: taskType,
          title: title.trim(),
          text_content: taskType === 'reading' ? textContent : undefined,
          question_ids: questionIds,
        });
      }
      if (taskType === 'listening' && audioFile) {
        saved = await api.assessment.uploadContentTaskAudio(saved.id, audioFile);
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const selected = questionIds
    .map((id) => availableQuestions.find((q) => q.id === id))
    .filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Редактировать' : 'Создать'}: {CONTENT_TASK_TYPE_LABEL[taskType]}
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
                placeholder={
                  taskType === 'listening' ? 'Диалог в магазине' : 'Текст о Пекине'
                }
              />
            </div>

            {taskType === 'reading' && (
              <div className="space-y-1.5">
                <Label>Текст для чтения</Label>
                <Textarea
                  rows={6}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Вставьте текст…"
                />
              </div>
            )}

            {taskType === 'listening' && (
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
            )}

            <div className="space-y-1.5">
              <Label>Вопросы из библиотеки</Label>
              {availableQuestions.length === 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Нет опубликованных атомарных вопросов. Сначала создайте тест-вопросы.
                </p>
              ) : (
                <ul className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-input p-2">
                  {availableQuestions.map((q) => (
                    <li key={q.id}>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={questionIds.includes(q.id)}
                          onChange={() => toggleQuestion(q.id)}
                        />
                        <span>
                          <span className="text-xs text-slate-500">
                            {QUESTION_TYPE_LABEL[q.type] || q.type}
                          </span>
                          <br />
                          <span className="line-clamp-2">{q.stem}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selected.length > 0 && (
              <div className="space-y-1">
                <Label>Выбрано ({selected.length})</Label>
                <ul className="space-y-1">
                  {selected.map((q, index) => (
                    <li
                      key={q.id}
                      className="flex items-center gap-2 text-sm rounded border px-2 py-1"
                    >
                      <span className="text-slate-400 w-5">{index + 1}.</span>
                      <span className="flex-1 truncate">{q.stem}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => toggleQuestion(q.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
              <>
                <Plus className="h-4 w-4 mr-2" />
                Сохранить
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
