import { useEffect, useState } from 'react';
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
import { DEFAULT_EXAM_RULE } from '@/lib/assessment-admin';
import { unwrapItems } from '@/lib/assessment-ui';

export default function ExamCreateDialog({ open, onOpenChange, onCreated }) {
  const [blocks, setBlocks] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(String(DEFAULT_EXAM_RULE.duration_minutes));
  const [passPercent, setPassPercent] = useState(
    String(DEFAULT_EXAM_RULE.pass_score_percent),
  );
  const [maxAttempts, setMaxAttempts] = useState(String(DEFAULT_EXAM_RULE.max_attempts));
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setError(null);
    setSelectedIds([]);
    setDuration(String(DEFAULT_EXAM_RULE.duration_minutes));
    setPassPercent(String(DEFAULT_EXAM_RULE.pass_score_percent));
    setMaxAttempts(String(DEFAULT_EXAM_RULE.max_attempts));
    setLoadingMeta(true);
    api.assessment
      .listExamBlocks({ status: 'published', limit: 200 })
      .then((payload) => {
        setBlocks(unwrapItems(payload));
      })
      .catch((err) => setError(err?.message || 'Не удалось загрузить блоки'))
      .finally(() => setLoadingMeta(false));
  }, [open]);

  const toggleBlock = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const moveSelected = (id, dir) => {
    setSelectedIds((prev) => {
      const index = prev.indexOf(id);
      if (index < 0) return prev;
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleCreate = async () => {
    if (selectedIds.length === 0) {
      setError('Выберите хотя бы один активный блок');
      return;
    }
    if (!name.trim()) {
      setError('Укажите название экзамена');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.assessment.createExam({
        block_ids: selectedIds,
        name: name.trim(),
        rule: {
          ...DEFAULT_EXAM_RULE,
          duration_minutes: Math.max(1, Number(duration) || 60),
          max_attempts: Math.max(1, Number(maxAttempts) || 1),
          pass_score_percent: Math.min(100, Math.max(0, Number(passPercent) || 60)),
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

  const selectedBlocks = selectedIds
    .map((id) => blocks.find((b) => b.id === id))
    .filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать экзамен из блоков</DialogTitle>
        </DialogHeader>

        {loadingMeta ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Вопрос → Блок → Экзамен. Порядок выбранных блоков сохранится в экзамене.
            </p>

            <div className="space-y-1.5">
              <Label>Активные блоки</Label>
              {blocks.length === 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Нет активных блоков. Сначала создайте и активируйте блок.
                </p>
              ) : (
                <ul className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-input p-2">
                  {blocks.map((b) => (
                    <li key={b.id}>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedIds.includes(b.id)}
                          onChange={() => toggleBlock(b.id)}
                        />
                        <span>
                          <span className="font-medium">{b.name}</span>
                          {b.level_label ? (
                            <span className="text-slate-500"> · {b.level_label}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedBlocks.length > 0 && (
              <div className="space-y-1.5">
                <Label>Порядок блоков в экзамене</Label>
                <ol className="space-y-1">
                  {selectedBlocks.map((b, index) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-2 text-sm rounded border border-slate-200 dark:border-slate-800 px-2 py-1.5"
                    >
                      <span className="text-slate-400 w-5">{index + 1}.</span>
                      <span className="flex-1 truncate">{b.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={index === 0}
                        onClick={() => moveSelected(b.id, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={index === selectedBlocks.length - 1}
                        onClick={() => moveSelected(b.id, 1)}
                      >
                        ↓
                      </Button>
                    </li>
                  ))}
                </ol>
              </div>
            )}

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
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleCreate}
            disabled={saving || loadingMeta || blocks.length === 0}
          >
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
