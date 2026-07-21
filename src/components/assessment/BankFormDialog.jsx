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

export default function BankFormDialog({
  open,
  onOpenChange,
  mode = 'create',
  bank = null,
  onSubmit,
}) {
  const editing = mode === 'edit';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locale, setLocale] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName(bank?.name || '');
    setDescription(bank?.description || '');
    setLocale(bank?.locale || '');
    setError(null);
    setSaving(false);
  }, [open, bank]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Укажите название банка');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        locale: locale.trim() || null,
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
            {editing ? 'Редактировать банк' : 'Новый банк вопросов'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="bank-name">Название</Label>
            <Input
              id="bank-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="HSK 1, Вступительный…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bank-desc">Описание</Label>
            <Textarea
              id="bank-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание банка"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bank-locale">Локаль (необязательно)</Label>
            <Input
              id="bank-locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              placeholder="ru, zh-CN…"
            />
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
            className="bg-primary hover:bg-primary/90"
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
