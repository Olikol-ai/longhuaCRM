import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CONTENT_TASK_TYPE_LABEL,
  DEFAULT_EXAM_RULE,
  QUESTION_TYPE_LABEL,
  unwrapItems,
} from '@/lib/assessment-admin';

const PART_KINDS = [
  { value: 'test', label: 'Тест' },
  { value: 'listening', label: 'Аудирование' },
  { value: 'reading', label: 'Чтение' },
];

function emptyPart(kind = 'test') {
  return {
    localKey: `part-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    part_kind: kind,
    title: PART_KINDS.find((p) => p.value === kind)?.label || kind,
    select_count: 1,
    pool_ids: [],
  };
}

/**
 * Create exam from generation rules (pools + select_count).
 */
export default function ExamCreateDialog({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(String(DEFAULT_EXAM_RULE.duration_minutes));
  const [passPercent, setPassPercent] = useState(
    String(DEFAULT_EXAM_RULE.pass_score_percent),
  );
  const [maxAttempts, setMaxAttempts] = useState(String(DEFAULT_EXAM_RULE.max_attempts));
  const [parts, setParts] = useState([emptyPart('test')]);
  const [questions, setQuestions] = useState([]);
  const [readingTasks, setReadingTasks] = useState([]);
  const [listeningTasks, setListeningTasks] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setError(null);
    setParts([emptyPart('test')]);
    setDuration(String(DEFAULT_EXAM_RULE.duration_minutes));
    setPassPercent(String(DEFAULT_EXAM_RULE.pass_score_percent));
    setMaxAttempts(String(DEFAULT_EXAM_RULE.max_attempts));
    setLoadingMeta(true);
    Promise.all([
      api.assessment.listQuestions({ status: 'published', limit: 500 }),
      api.assessment.listReadingTasks(),
      api.assessment.listListeningTasks(),
    ])
      .then(([qs, reading, listening]) => {
        setQuestions(unwrapItems(qs));
        const r = Array.isArray(reading) ? reading : unwrapItems(reading);
        const l = Array.isArray(listening) ? listening : unwrapItems(listening);
        setReadingTasks(r.filter((t) => t.status === 'published'));
        setListeningTasks(l.filter((t) => t.status === 'published'));
      })
      .catch((err) => setError(err?.message || 'Не удалось загрузить пулы'))
      .finally(() => setLoadingMeta(false));
  }, [open]);

  const poolOptions = useMemo(() => {
    return {
      test: questions.map((q) => ({
        id: q.id,
        label: `${QUESTION_TYPE_LABEL[q.type] || q.type}: ${q.stem}`,
      })),
      listening: listeningTasks.map((t) => ({ id: t.id, label: t.title })),
      reading: readingTasks.map((t) => ({ id: t.id, label: t.title })),
    };
  }, [questions, readingTasks, listeningTasks]);

  const updatePart = (localKey, patch) => {
    setParts((prev) =>
      prev.map((p) => (p.localKey === localKey ? { ...p, ...patch } : p)),
    );
  };

  const togglePool = (localKey, id) => {
    setParts((prev) =>
      prev.map((p) => {
        if (p.localKey !== localKey) return p;
        const pool_ids = p.pool_ids.includes(id)
          ? p.pool_ids.filter((x) => x !== id)
          : [...p.pool_ids, id];
        return { ...p, pool_ids };
      }),
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Укажите название экзамена');
      return;
    }
    if (parts.length === 0) {
      setError('Добавьте хотя бы одну часть');
      return;
    }
    for (const part of parts) {
      if (part.pool_ids.length < 1) {
        setError(`Часть «${part.title}»: выберите элементы пула`);
        return;
      }
      if (part.pool_ids.length < Number(part.select_count || 1)) {
        setError(`Часть «${part.title}»: пул меньше числа выбираемых`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.assessment.createExam({
        name: name.trim(),
        parts: parts.map((part) => ({
          part_kind: part.part_kind,
          title: part.title,
          select_count: Math.max(1, Number(part.select_count) || 1),
          pool: part.pool_ids.map((id) => {
            if (part.part_kind === 'test') return { question_id: id };
            if (part.part_kind === 'reading') return { reading_task_id: id };
            return { listening_task_id: id };
          }),
        })),
        rule: {
          ...DEFAULT_EXAM_RULE,
          duration_minutes: Math.max(1, Number(duration) || 60),
          max_attempts: Math.max(1, Number(maxAttempts) || 1),
          pass_score_percent: Math.min(100, Math.max(0, Number(passPercent) || 60)),
          randomize_questions: true,
        },
      });
      onCreated?.(created);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'Не удалось создать экзамен');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать экзамен из пулов</DialogTitle>
        </DialogHeader>

        {loadingMeta ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              При старте попытки из каждого пула случайно выбирается указанное число элементов.
            </p>

            <div className="space-y-1.5">
              <Label>Название экзамена</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="HSK 1 — март"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Время (мин)</Label>
                <Input
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Проходной %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={passPercent}
                  onChange={(e) => setPassPercent(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Попытки</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Части экзамена</Label>
                <div className="flex flex-wrap gap-1">
                  {PART_KINDS.map((kind) => (
                    <Button
                      key={kind.value}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setParts((prev) => [...prev, emptyPart(kind.value)])}
                    >
                      + {kind.label}
                    </Button>
                  ))}
                </div>
              </div>

              {parts.map((part, index) => {
                const options = poolOptions[part.part_kind] || [];
                return (
                  <div
                    key={part.localKey}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        Часть {index + 1}:{' '}
                        {CONTENT_TASK_TYPE_LABEL[part.part_kind] ||
                          PART_KINDS.find((k) => k.value === part.part_kind)?.label}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={parts.length <= 1}
                        onClick={() =>
                          setParts((prev) => prev.filter((p) => p.localKey !== part.localKey))
                        }
                      >
                        Удалить
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Заголовок</Label>
                        <Input
                          value={part.title}
                          onChange={(e) => updatePart(part.localKey, { title: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Сколько выбрать</Label>
                        <Input
                          type="number"
                          min={1}
                          value={part.select_count}
                          onChange={(e) =>
                            updatePart(part.localKey, { select_count: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Пул ({part.pool_ids.length})</Label>
                      {options.length === 0 ? (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Нет опубликованных элементов этого типа
                        </p>
                      ) : (
                        <ul className="max-h-32 overflow-y-auto space-y-1 rounded-md border p-2">
                          {options.map((opt) => (
                            <li key={opt.id}>
                              <label className="flex items-start gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={part.pool_ids.includes(opt.id)}
                                  onChange={() => togglePool(part.localKey, opt.id)}
                                />
                                <span className="line-clamp-2">{opt.label}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
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
          <Button onClick={handleCreate} disabled={saving || loadingMeta}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Создание…
              </>
            ) : (
              'Создать экзамен'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
