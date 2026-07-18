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
import { unwrapItems } from '@/lib/assessment-ui';
import { LIFECYCLE_STATUS_LABEL } from '@/lib/assessment-admin';

/**
 * Create Blueprint: name + published ExamTemplate + bank.
 * Supports quick-create+publish of ExamTemplate when none exist.
 */
export default function BlueprintCreateDialog({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [bankId, setBankId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [banks, setBanks] = useState([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadMeta = async () => {
    setLoadingMeta(true);
    setError(null);
    try {
      const [tplPayload, banksPayload] = await Promise.all([
        api.assessment.listExamTemplates({ limit: 200 }),
        api.assessment.listBanks({ limit: 200 }),
      ]);
      const allTemplates = unwrapItems(tplPayload);
      const published = allTemplates.filter((t) => t.status === 'published');
      setTemplates(published);
      setBanks(unwrapItems(banksPayload));
      if (published[0]?.id) setTemplateId(published[0].id);
      const firstBank = unwrapItems(banksPayload)[0];
      if (firstBank?.id) setBankId(firstBank.id);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить данные');
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setName('');
    setNewTemplateName('');
    setError(null);
    loadMeta();
  }, [open]);

  const createAndPublishTemplate = async () => {
    if (!newTemplateName.trim()) {
      setError('Укажите название шаблона');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.assessment.createExamTemplate({
        name: newTemplateName.trim(),
      });
      const published = await api.assessment.publishExamTemplate(created.id);
      setTemplates((prev) => [...prev, published]);
      setTemplateId(published.id);
      setNewTemplateName('');
    } catch (err) {
      setError(err?.message || 'Не удалось создать шаблон');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Укажите название структуры экзамена');
      return;
    }
    if (!templateId) {
      setError('Выберите или создайте опубликованный шаблон экзамена');
      return;
    }
    if (!bankId) {
      setError('Выберите банк вопросов');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.assessment.createBlueprint({
        name: name.trim(),
        exam_template_id: templateId,
        bank_id: bankId,
        section_rules: [],
      });
      onCreated?.(created);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'Не удалось создать структуру экзамена');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Новая структура экзамена</DialogTitle>
        </DialogHeader>

        {loadingMeta ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="bp-name">Название</Label>
              <Input
                id="bp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="HSK 1 — стандарт"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bp-template">Шаблон экзамена (опубликованный)</Label>
              <select
                id="bp-template"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Выберите шаблон</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {templates.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-3 space-y-2">
                  <p className="text-xs text-slate-500">
                    Нет опубликованных шаблонов. Создайте и опубликуйте здесь:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="Название шаблона"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={createAndPublishTemplate}
                    >
                      Создать
                    </Button>
                  </div>
                </div>
              )}
              {templates.length > 0 && (
                <div className="flex gap-2 pt-1">
                  <Input
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Или новый шаблон…"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={createAndPublishTemplate}
                  >
                    + Шаблон
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bp-bank">Банк вопросов</Label>
              <select
                id="bp-bank"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
              >
                <option value="">Выберите банк</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({LIFECYCLE_STATUS_LABEL[b.status] || b.status})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Описание структуры в системе не хранится отдельно — укажите смысл в
                названии.
              </p>
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
            disabled={saving || loadingMeta}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Создание…
              </>
            ) : (
              'Создать'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
