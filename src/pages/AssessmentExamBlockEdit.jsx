import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { api } from '@/api';
import LifecycleBadge from '@/components/assessment/LifecycleBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { useAssessmentExamBlock } from '@/hooks/useAssessmentExamBlocks';
import { QUESTION_TYPE_LABEL, unwrapItems } from '@/lib/assessment-admin';

export default function AssessmentExamBlockEdit() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const blockId = params.get('id') || '';
  const { block, loading, error, reload } = useAssessmentExamBlock(blockId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [levelLabel, setLevelLabel] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [questionIds, setQuestionIds] = useState([]);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [pickId, setPickId] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const readOnly = block && block.status === 'archived';

  useEffect(() => {
    if (!block) return;
    setName(block.name || '');
    setDescription(block.description || '');
    setLevelLabel(block.level_label || '');
    setDurationMinutes(
      block.duration_minutes != null ? String(block.duration_minutes) : '',
    );
    const ids = (block.items || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((item) => item.question_id || item.question?.id)
      .filter(Boolean);
    setQuestionIds(ids);
  }, [block]);

  useEffect(() => {
    api.assessment
      .listQuestions({ status: 'published', limit: 500 })
      .then((payload) => setAvailableQuestions(unwrapItems(payload)))
      .catch(() => setAvailableQuestions([]));
  }, []);

  const questionById = useMemo(() => {
    const map = new Map();
    availableQuestions.forEach((q) => map.set(q.id, q));
    (block?.items || []).forEach((item) => {
      if (item.question) map.set(item.question.id || item.question_id, item.question);
    });
    return map;
  }, [availableQuestions, block]);

  const pickable = useMemo(
    () => availableQuestions.filter((q) => !questionIds.includes(q.id)),
    [availableQuestions, questionIds],
  );

  const move = (index, dir) => {
    const next = [...questionIds];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setQuestionIds(next);
  };

  const removeAt = (index) => {
    setQuestionIds((prev) => prev.filter((_, i) => i !== index));
  };

  const addPicked = () => {
    if (!pickId || questionIds.includes(pickId)) return;
    setQuestionIds((prev) => [...prev, pickId]);
    setPickId('');
  };

  const handleSave = async () => {
    if (!blockId || readOnly) return;
    if (!name.trim()) {
      toast({ title: 'Укажите название блока', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api.assessment.updateExamBlock(blockId, {
        name: name.trim(),
        description: description.trim() || null,
        level_label: levelLabel.trim() || null,
        duration_minutes: durationMinutes ? Math.max(1, Number(durationMinutes)) : null,
        question_ids: questionIds,
      });
      toast({ title: 'Блок сохранён' });
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!blockId) return;
    setBusy(true);
    try {
      if (!readOnly) {
        await api.assessment.updateExamBlock(blockId, {
          name: name.trim(),
          description: description.trim() || null,
          level_label: levelLabel.trim() || null,
          duration_minutes: durationMinutes ? Math.max(1, Number(durationMinutes)) : null,
          question_ids: questionIds,
        });
      }
      await api.assessment.publishExamBlock(blockId);
      toast({ title: 'Блок активирован' });
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось активировать',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!blockId) {
    return (
      <div className="p-8">
        <p className="text-sm text-rose-600">Не указан id блока</p>
        <Button className="mt-4" onClick={() => navigate(createPageUrl('AssessmentExamBlocks'))}>
          К списку
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (error || !block) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-sm text-rose-600">{error?.message || 'Блок не найден'}</p>
        <Link to={createPageUrl('AssessmentExamBlocks')} className="text-sm text-brand">
          ← К списку блоков
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to={createPageUrl('AssessmentExamBlocks')}
            className="text-xs text-slate-500 hover:text-brand"
          >
            ← К блокам
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Редактор блока
            </h1>
            <LifecycleBadge status={block.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Добавьте опубликованные вопросы и задайте порядок.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || busy}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Сохранить
            </Button>
          )}
          {block.status === 'draft' && (
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90"
              onClick={handlePublish}
              disabled={busy || saving}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Активировать
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
        <div className="space-y-1.5">
          <Label>Название</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} />
        </div>
        <div className="space-y-1.5">
          <Label>Описание</Label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={readOnly}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Уровень</Label>
            <Input
              value={levelLabel}
              onChange={(e) => setLevelLabel(e.target.value)}
              placeholder="HSK 1"
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Время (мин)</Label>
            <Input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
        <h2 className="font-semibold text-slate-900 dark:text-white">Вопросы блока</h2>
        {!readOnly && (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
            >
              <option value="">Выберите опубликованный вопрос</option>
              {pickable.map((q) => (
                <option key={q.id} value={q.id}>
                  {(QUESTION_TYPE_LABEL[q.type] || q.type) + ': ' + (q.stem || '').slice(0, 80)}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={addPicked} disabled={!pickId}>
              <Plus className="h-4 w-4 mr-1" />
              Добавить
            </Button>
          </div>
        )}

        {questionIds.length === 0 ? (
          <p className="text-sm text-slate-500">Пока нет вопросов в блоке.</p>
        ) : (
          <ol className="space-y-2">
            {questionIds.map((qid, index) => {
              const q = questionById.get(qid);
              return (
                <li
                  key={qid}
                  className="flex items-start gap-2 rounded-md border border-slate-100 dark:border-slate-800 p-3"
                >
                  <span className="text-xs text-slate-400 w-6 pt-1">{index + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2">
                      {q?.stem || qid}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {QUESTION_TYPE_LABEL[q?.type] || q?.type || 'вопрос'}
                      {q?.difficulty != null ? ` · сложность ${q.difficulty}` : ''}
                    </p>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => move(index, 1)}
                        disabled={index === questionIds.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-600"
                        onClick={() => removeAt(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
