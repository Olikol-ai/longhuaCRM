import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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

export default function ExamTemplateFormDialog({
  open,
  onOpenChange,
  mode = 'create',
  template = null,
  onSubmit,
}) {
  const editing = mode === 'edit';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locale, setLocale] = useState('');
  const [levelLabel, setLevelLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName(template?.name || '');
    setDescription(template?.description || '');
    setLocale(template?.locale || '');
    setLevelLabel(template?.level_label || '');
    setError(null);
    setSaving(false);
  }, [open, template]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Укажите название шаблона');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        locale: locale.trim() || null,
        level_label: levelLabel.trim() || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Редактировать шаблон' : 'Новый шаблон экзамена'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Название</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="HSK 1 итог, Вступительный…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">Описание</Label>
            <Textarea
              id="tpl-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание шаблона"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-locale">Локаль (необязательно)</Label>
              <Input
                id="tpl-locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                placeholder="ru, zh-CN…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-level">Уровень (необязательно)</Label>
              <Input
                id="tpl-level"
                value={levelLabel}
                onChange={(e) => setLevelLabel(e.target.value)}
                placeholder="HSK 1, A1…"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={handleSave}
            disabled={saving}
          >
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
