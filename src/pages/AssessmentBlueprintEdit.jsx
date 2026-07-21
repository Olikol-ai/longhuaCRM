import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, Loader2, Save, Send } from 'lucide-react';
import { api } from '@/api';
import BlueprintPreviewDialog from '@/components/assessment/BlueprintPreviewDialog';
import BlueprintSectionEditor from '@/components/assessment/BlueprintSectionEditor';
import LifecycleBadge from '@/components/assessment/LifecycleBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { useAssessmentBlueprint } from '@/hooks/useAssessmentBlueprints';
import {
  canPublishBlueprint,
  emptyBlueprintSection,
  toSectionRulePayload,
} from '@/lib/assessment-admin';

function mapRulesToEditor(rules = []) {
  return [...rules]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((r, index) => ({
      local_id: r.id || `rule-${index}`,
      id: r.id,
      section_key: r.section_key,
      title: r.title || '',
      question_type: r.question_types?.[0] || 'single_choice',
      question_types: r.question_types || ['single_choice'],
      question_count: Number(r.question_count) || 1,
      weight: Number(r.weight) || 0,
      difficulty_min: Number(r.difficulty_min) || 1,
      difficulty_max: Number(r.difficulty_max) || 5,
    }));
}

export default function AssessmentBlueprintEdit() {
  const [params] = useSearchParams();
  const blueprintId = params.get('id') || '';
  const navigate = useNavigate();
  const { blueprint, loading, error, reload } = useAssessmentBlueprint(blueprintId);

  const [name, setName] = useState('');
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const readOnly = blueprint?.status !== 'draft';

  useEffect(() => {
    if (!blueprint) return;
    setName(blueprint.name || '');
    const rules = blueprint.section_rules || [];
    setSections(rules.length ? mapRulesToEditor(rules) : []);
  }, [blueprint]);

  const publishGate = useMemo(() => canPublishBlueprint(sections), [sections]);

  const handleSave = async () => {
    if (readOnly) return;
    if (!name.trim()) {
      toast({
        title: 'Укажите название',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await api.assessment.updateBlueprint(blueprintId, {
        name: name.trim(),
        section_rules: toSectionRulePayload(sections),
      });
      toast({ title: 'Структура экзамена сохранена' });
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
    if (!publishGate.ok) {
      toast({
        title: 'Нельзя опубликовать',
        description: publishGate.reason,
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await api.assessment.updateBlueprint(blueprintId, {
        name: name.trim(),
        section_rules: toSectionRulePayload(sections),
      });
      await api.assessment.publishBlueprint(blueprintId);
      toast({ title: 'Структура экзамена опубликована' });
      reload();
    } catch (err) {
      toast({
        title: 'Ошибка публикации',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreview(null);
    try {
      if (!readOnly) {
        await api.assessment.updateBlueprint(blueprintId, {
          name: name.trim() || blueprint?.name,
          section_rules: toSectionRulePayload(sections),
        });
      }
      const result = await api.assessment.previewBlueprint(blueprintId, {});
      setPreview(result);
    } catch (err) {
      toast({
        title: 'Предпросмотр недоступен',
        description: err?.message,
        variant: 'destructive',
      });
      setPreview({
        ok: false,
        sections: [],
        errors: [err?.message || 'Ошибка'],
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  if (!blueprintId) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <p className="text-slate-600 dark:text-slate-300">Не указана структура экзамена.</p>
        <Button asChild variant="outline">
          <Link to={createPageUrl('AssessmentBlueprints')}>К списку</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (error || !blueprint) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200">
          {error?.message || 'Структура экзамена не найдена'}
        </div>
        <Button asChild variant="outline">
          <Link to={createPageUrl('AssessmentBlueprints')}>Назад</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to={createPageUrl('AssessmentBlueprints')}
            className="text-xs text-slate-500 hover:text-brand dark:hover:text-brand"
          >
            ← Структура экзамена
          </Link>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Редактор структуры
            </h1>
            <LifecycleBadge status={blueprint.status} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {readOnly
              ? 'Только просмотр — редактирование доступно в статусе «Черновик»'
              : 'Настройте секции и веса (сумма = 100%)'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePreview}>
            <Eye className="h-4 w-4 mr-1" />
            Предпросмотр
          </Button>
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" disabled={saving} onClick={handleSave}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Сохранить
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                size="sm"
                disabled={saving || !publishGate.ok}
                onClick={handlePublish}
                title={publishGate.reason || ''}
              >
                <Send className="h-4 w-4 mr-1" />
                Опубликовать
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="bp-edit-name">Название</Label>
          <Input
            id="bp-edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={readOnly}
          />
        </div>
        <p className="text-xs text-slate-400">
          Банк вопросов и шаблон экзамена задаются при создании и не меняются в
          редакторе черновика.
        </p>
      </div>

      <BlueprintSectionEditor
        sections={sections}
        onChange={setSections}
        readOnly={readOnly}
      />

      {!readOnly && sections.length === 0 && (
        <Button
          variant="outline"
          onClick={() => setSections([emptyBlueprintSection(0)])}
        >
          Добавить первую секцию
        </Button>
      )}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl('AssessmentBlueprints'))}
        >
          К списку
        </Button>
      </div>

      <BlueprintPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
        sections={sections}
        loading={previewLoading}
        blueprintName={name || blueprint.name}
      />
    </div>
  );
}
