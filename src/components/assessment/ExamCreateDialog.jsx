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
  const [blueprints, setBlueprints] = useState([]);
  const [blueprintId, setBlueprintId] = useState('');
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
    setDuration(String(DEFAULT_EXAM_RULE.duration_minutes));
    setPassPercent(String(DEFAULT_EXAM_RULE.pass_score_percent));
    setMaxAttempts(String(DEFAULT_EXAM_RULE.max_attempts));
    setLoadingMeta(true);
    api.assessment
      .listBlueprints({ status: 'published', limit: 200 })
      .then((payload) => {
        const items = unwrapItems(payload);
        setBlueprints(items);
        setBlueprintId(items[0]?.id || '');
      })
      .catch((err) => setError(err?.message || 'Не удалось загрузить структуры экзамена'))
      .finally(() => setLoadingMeta(false));
  }, [open]);

  const handleCreate = async () => {
    if (!blueprintId) {
      setError('Выберите опубликованную структуру экзамена');
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
        blueprint_id: blueprintId,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Создать экзамен из структуры</DialogTitle>
        </DialogHeader>

        {loadingMeta ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Структура → Экзамен → Вопросы (подбор при создании)
            </p>
            <div className="space-y-1.5">
              <Label>Опубликованная структура экзамена</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={blueprintId}
                onChange={(e) => setBlueprintId(e.target.value)}
              >
                <option value="">Выберите структуру</option>
                {blueprints.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {blueprints.length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Нет опубликованных структур. Сначала опубликуйте структуру экзамена.
                </p>
              )}
            </div>
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
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={handleCreate}
            disabled={saving || loadingMeta || blueprints.length === 0}
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
