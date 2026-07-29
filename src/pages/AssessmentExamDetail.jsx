import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, Eye, Loader2, Save, Send } from 'lucide-react';
import { api } from '@/api';
import LifecycleBadge from '@/components/assessment/LifecycleBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { useAssessmentExamDetail } from '@/hooks/useAssessmentExams';
import { DEFAULT_EXAM_RULE, formatDateTime, QUESTION_TYPE_LABEL } from '@/lib/assessment-admin';

function ruleFromExam(exam) {
  const r = exam?.rule || {};
  return {
    duration_minutes: r.duration_minutes ?? DEFAULT_EXAM_RULE.duration_minutes,
    max_attempts: r.max_attempts ?? DEFAULT_EXAM_RULE.max_attempts,
    allow_retake: Boolean(r.allow_retake),
    retake_policy: r.retake_policy || DEFAULT_EXAM_RULE.retake_policy,
    allow_review: Boolean(r.allow_review),
    show_result_after_submit:
      r.show_result_after_submit ?? DEFAULT_EXAM_RULE.show_result_after_submit,
    show_correct_answers:
      r.show_correct_answers || DEFAULT_EXAM_RULE.show_correct_answers,
    auto_submit_on_timeout:
      r.auto_submit_on_timeout ?? DEFAULT_EXAM_RULE.auto_submit_on_timeout,
    allow_pause: Boolean(r.allow_pause),
    randomize_questions:
      r.randomize_questions ?? DEFAULT_EXAM_RULE.randomize_questions,
    randomize_answers: r.randomize_answers ?? DEFAULT_EXAM_RULE.randomize_answers,
    passing_mode: r.passing_mode || DEFAULT_EXAM_RULE.passing_mode,
    pass_score_percent:
      r.pass_score_percent ?? DEFAULT_EXAM_RULE.pass_score_percent,
    allow_navigation: r.allow_navigation ?? DEFAULT_EXAM_RULE.allow_navigation,
  };
}

export default function AssessmentExamDetail() {
  const [params] = useSearchParams();
  const examId = params.get('id') || '';
  const { exam, preview, loading, error, reload } = useAssessmentExamDetail(examId);

  const [name, setName] = useState('');
  const [rule, setRule] = useState(DEFAULT_EXAM_RULE);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const readOnly = exam?.status !== 'draft';

  useEffect(() => {
    if (!exam) return;
    setName(exam.name || '');
    setRule(ruleFromExam(exam));
  }, [exam]);

  const sections = useMemo(() => {
    const parts = exam?.parts || [];
    if (parts.length > 0) {
      return [...parts]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((part) => ({
          section_key: part.part_kind,
          title: part.title || part.part_kind,
          weight: null,
          select_count: part.select_count,
          pool_size: (part.pool_items || []).length,
          questions: (part.pool_items || []).map((item) => ({
            id: item.question_id || item.reading_task_id || item.listening_task_id || item.id,
            stem:
              item.question?.stem ||
              item.reading_task?.title ||
              item.listening_task?.title ||
              'Элемент пула',
            type: item.question?.type || part.part_kind,
          })),
        }));
    }

    const titleByKey = new Map(
      (exam?.sections || []).map((s) => [s.section_key, s.title || s.section_key]),
    );

    if (preview?.sections?.length) {
      return preview.sections.map((s) => {
        const key = s.section_key || s.sectionKey;
        return {
          section_key: key,
          title: titleByKey.get(key) || key,
          weight: s.weight,
          select_count: s.select_count ?? s.selectCount,
          pool_size: s.pool_size ?? s.poolSize,
          questions: (s.questions || []).map((q) => ({
            id: q.id,
            stem: q.stem,
            type: q.type,
          })),
        };
      });
    }

    const examSections = exam?.sections || [];
    const examQuestions = exam?.exam_questions || [];
    return [...examSections]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((s) => ({
        section_key: s.section_key,
        title: s.title || s.section_key,
        weight: s.weight,
        questions: examQuestions
          .filter((q) => q.section_id === s.id)
          .map((q) => ({
            id: q.question_id || q.id,
            stem: q.stem || q.question_id || 'Вопрос',
            type: q.type,
          })),
      }));
  }, [exam, preview]);

  const totalQuestions = sections.reduce(
    (sum, s) => sum + (s.questions?.length || 0),
    0,
  );

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      await api.assessment.updateExam(examId, {
        name: name.trim(),
        rule: {
          ...rule,
          duration_minutes: Math.max(1, Number(rule.duration_minutes) || 60),
          max_attempts: Math.max(1, Number(rule.max_attempts) || 1),
          pass_score_percent: Number(rule.pass_score_percent) || 0,
        },
      });
      toast({ title: 'Экзамен сохранён' });
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
    setSaving(true);
    try {
      if (!readOnly) {
        await api.assessment.updateExam(examId, {
          name: name.trim(),
          rule: {
            ...rule,
            duration_minutes: Math.max(1, Number(rule.duration_minutes) || 60),
            max_attempts: Math.max(1, Number(rule.max_attempts) || 1),
            pass_score_percent: Number(rule.pass_score_percent) || 0,
          },
        });
      }
      await api.assessment.publishExam(examId);
      toast({ title: 'Экзамен опубликован' });
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось опубликовать',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    setSaving(true);
    try {
      await api.assessment.archiveExam(examId);
      toast({ title: 'Экзамен архивирован' });
      setConfirmArchive(false);
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось архивировать',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!examId) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <p>Не указан экзамен.</p>
        <Button asChild variant="outline">
          <Link to={createPageUrl('AssessmentExams')}>К списку</Link>
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

  if (error || !exam) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200">
          {error?.message || 'Экзамен не найден'}
        </div>
        <Button asChild variant="outline">
          <Link to={createPageUrl('AssessmentExams')}>Назад</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to={createPageUrl('AssessmentExams')}
            className="text-xs text-slate-500 hover:text-brand dark:hover:text-brand"
          >
            ← Экзамены
          </Link>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {exam.name}
            </h1>
            <LifecycleBadge status={exam.status} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Вопросов: {totalQuestions} · Создан: {formatDateTime(exam.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-1" />
            Предпросмотр
          </Button>
          {exam.status === 'draft' && (
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
                disabled={saving}
                onClick={handlePublish}
              >
                <Send className="h-4 w-4 mr-1" />
                Опубликовать
              </Button>
            </>
          )}
          {exam.status === 'published' && (
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setConfirmArchive(true)}
            >
              <Archive className="h-4 w-4 mr-1" />
              В архив
            </Button>
          )}
          {exam.status !== 'archived' && exam.status !== 'published' && (
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setConfirmArchive(true)}
            >
              <Archive className="h-4 w-4 mr-1" />
              В архив
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold text-slate-900 dark:text-white">Основные данные</h2>
        <div className="space-y-1.5">
          <Label>Название</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={readOnly}
          />
        </div>
      </Card>

      <Card className="p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold text-slate-900 dark:text-white">
          Правило прохождения
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Время (мин)</Label>
            <Input
              type="number"
              min={1}
              value={rule.duration_minutes}
              onChange={(e) =>
                setRule((prev) => ({ ...prev, duration_minutes: e.target.value }))
              }
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Макс. попыток</Label>
            <Input
              type="number"
              min={1}
              value={rule.max_attempts}
              onChange={(e) =>
                setRule((prev) => ({ ...prev, max_attempts: e.target.value }))
              }
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Проходной %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={rule.pass_score_percent}
              onChange={(e) =>
                setRule((prev) => ({
                  ...prev,
                  pass_score_percent: e.target.value,
                }))
              }
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Показ правильных ответов</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={rule.show_correct_answers}
              onChange={(e) =>
                setRule((prev) => ({
                  ...prev,
                  show_correct_answers: e.target.value,
                }))
              }
              disabled={readOnly}
            >
              <option value="never">Никогда</option>
              <option value="after_submit">После сдачи</option>
              <option value="after_pass">После успешной сдачи</option>
              <option value="always">Всегда</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {[
            ['auto_submit_on_timeout', 'Авто-сдача по таймеру'],
            ['randomize_questions', 'Случайный порядок вопросов'],
            ['randomize_answers', 'Случайный порядок ответов'],
            ['allow_navigation', 'Навигация между вопросами'],
            ['show_result_after_submit', 'Показать результат после сдачи'],
            ['allow_retake', 'Разрешить пересдачу'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="accent-brand"
                checked={Boolean(rule[key])}
                onChange={(e) =>
                  setRule((prev) => ({ ...prev, [key]: e.target.checked }))
                }
                disabled={readOnly}
              />
              {label}
            </label>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">
          Блоки и вопросы ({totalQuestions})
        </h2>
        {sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center text-sm text-slate-500">
            Блоки ещё не загружены
          </div>
        ) : (
          sections.map((section) => (
            <Card key={section.section_key} className="p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-slate-900 dark:text-white">
                  {section.title || section.section_key}
                </h3>
                <p className="text-xs text-slate-500">
                  {section.questions?.length || 0} вопр.
                  {section.weight != null ? ` · вес ${section.weight}%` : ''}
                  {section.level_label || section.levelLabel
                    ? ` · ${section.level_label || section.levelLabel}`
                    : ''}
                </p>
              </div>
              <ul className="space-y-2">
                {(section.questions || []).map((q, idx) => (
                  <li
                    key={q.id || q.snapshot_id || idx}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm"
                  >
                    <span className="text-xs text-brand dark:text-brand mr-2">
                      {idx + 1}.
                    </span>
                    <span className="text-slate-800 dark:text-slate-100">
                      {q.stem || 'Вопрос'}
                    </span>
                    {q.type ? (
                      <span className="ml-2 text-xs text-slate-400">
                        {QUESTION_TYPE_LABEL[q.type] || q.type}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Предпросмотр экзамена</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-slate-500">
              {exam.name} · {rule.duration_minutes} мин · проходной{' '}
              {rule.pass_score_percent}%
            </p>
            {sections.map((section) => (
              <div
                key={section.section_key}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"
              >
                <p className="font-medium">
                  {section.title} ({section.questions?.length || 0})
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Вес: {section.weight ?? '—'}%
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать экзамен?</AlertDialogTitle>
            <AlertDialogDescription>
              Новые попытки будут недоступны.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={handleArchive}>
              {saving ? "Архивирование…" : "Архивировать"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
