import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api, getToken } from '@/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { QUESTION_TYPE_LABEL, displayPersonName, formatDateTime } from '@/lib/assessment-admin';
import { unwrapItems } from '@/lib/assessment-ui';

const REVIEW_STATUS_LABEL = {
  not_reviewed: 'Не проверено',
  in_progress: 'Проверяется',
  reviewed: 'Проверено',
};

function reviewStatusClass(status) {
  if (status === 'reviewed') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
  }
  if (status === 'in_progress') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
}

function ReviewAudioPlayer({ url }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    if (!url) {
      setSrc(null);
      return undefined;
    }
    (async () => {
      try {
        const token = getToken();
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('audio');
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (!url) return null;
  if (!src) {
    return <p className="text-xs text-slate-500">Загрузка аудио…</p>;
  }
  return (
    <audio controls className="w-full" preload="metadata" src={src}>
      Ваш браузер не поддерживает аудио.
    </audio>
  );
}

export default function TeacherAssessmentReviewDetail() {
  const [params] = useSearchParams();
  const resultId = params.get('id') || '';

  const [bundle, setBundle] = useState(null);
  const [studentName, setStudentName] = useState('—');
  const [examName, setExamName] = useState('Экзамен');
  const [loading, setLoading] = useState(Boolean(resultId));
  const [error, setError] = useState(null);
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const applyBundle = useCallback((payload) => {
    setBundle(payload);
    const nextScores = {};
    const nextComments = {};
    for (const item of payload?.items || []) {
      const key = item.question_snapshot_id;
      if (item.score != null) nextScores[key] = String(item.score);
      if (item.review_comment) nextComments[key] = item.review_comment;
    }
    setScores(nextScores);
    setComments(nextComments);
  }, []);

  const reload = useCallback(async () => {
    if (!resultId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await api.assessment.getResultReview(resultId);
      applyBundle(payload);

      const result = payload.result || {};
      const exam = result.exam_id
        ? await api.assessment.getExam(result.exam_id).catch(() => null)
        : null;
      setExamName(exam?.name || 'Экзамен');

      const attemptId = result.attempt_id;
      const [attemptsPayload, studentsPayload] = await Promise.all([
        attemptId
          ? api.assessment.listAttempts({ limit: 200 }).catch(() => ({ items: [] }))
          : Promise.resolve({ items: [] }),
        api.students.list().catch(() => []),
      ]);
      const attempt = unwrapItems(attemptsPayload).find((a) => a.id === attemptId);
      const students = Array.isArray(studentsPayload)
        ? studentsPayload
        : unwrapItems(studentsPayload);
      const student = students.find((s) => s.id === attempt?.student_id);
      setStudentName(student ? displayPersonName(student) : '—');
    } catch (err) {
      setError(err);
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [resultId, applyBundle]);

  useEffect(() => {
    reload();
  }, [reload]);

  const items = bundle?.items || [];
  const result = bundle?.result;
  const reviewStatus = bundle?.review_status || 'not_reviewed';
  const isFinalized =
    reviewStatus === 'reviewed' ||
    result?.status === 'passed' ||
    result?.status === 'failed';

  const manualItems = useMemo(
    () => items.filter((i) => i.requires_manual_review),
    [items],
  );

  const handleSave = async () => {
    if (!resultId || isFinalized) return;
    setSaving(true);
    try {
      const answers = manualItems.map((item) => {
        const key = item.question_snapshot_id;
        const raw = scores[key];
        if (raw === undefined || raw === '') {
          throw new Error('Укажите балл для всех заданий на проверку');
        }
        const score = Number(raw);
        if (Number.isNaN(score) || score < 0) {
          throw new Error('Балл должен быть числом не меньше 0');
        }
        if (score > Number(item.points)) {
          throw new Error(`Балл не может превышать ${item.points}`);
        }
        return {
          question_snapshot_id: key,
          score,
          comment: comments[key]?.trim() || null,
        };
      });

      const saved = await api.assessment.saveResultReview(resultId, { answers });
      applyBundle(saved);
      toast({ title: 'Оценки сохранены' });
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

  const handleFinalize = async () => {
    if (!resultId || isFinalized) return;
    setFinalizing(true);
    try {
      const answers = manualItems.map((item) => {
        const key = item.question_snapshot_id;
        const raw = scores[key];
        if (raw === undefined || raw === '') {
          throw new Error('Укажите балл для всех заданий на проверку');
        }
        const score = Number(raw);
        if (Number.isNaN(score) || score < 0 || score > Number(item.points)) {
          throw new Error(`Балл для задания должен быть от 0 до ${item.points}`);
        }
        return {
          question_snapshot_id: key,
          score,
          comment: comments[key]?.trim() || null,
        };
      });
      await api.assessment.saveResultReview(resultId, { answers });
      const finalized = await api.assessment.finalizeResultReview(resultId);
      await reload();
      toast({
        title:
          finalized.passed || finalized.status === 'passed'
            ? 'Проверка завершена — экзамен сдан'
            : 'Проверка завершена — экзамен не сдан',
      });
    } catch (err) {
      toast({
        title: 'Не удалось завершить проверку',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setFinalizing(false);
    }
  };

  if (!resultId) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <p>Не указана работа.</p>
        <Button asChild variant="outline">
          <Link to={createPageUrl('TeacherAssessmentReview')}>Назад</Link>
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

  if (error || !bundle) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200">
          {error?.message || 'Не удалось открыть работу'}
        </div>
        <Button asChild variant="outline">
          <Link to={createPageUrl('TeacherAssessmentReview')}>Назад</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 pb-28">
      <div>
        <Link
          to={createPageUrl('TeacherAssessmentReview')}
          className="text-xs text-slate-500 hover:text-brand dark:hover:text-brand"
        >
          ← Работы на проверку
        </Link>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {examName}
          </h1>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${reviewStatusClass(reviewStatus)}`}
          >
            {REVIEW_STATUS_LABEL[reviewStatus] || reviewStatus}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {studentName} · {formatDateTime(result?.finished_at || result?.created_at)}
        </p>
      </div>

      {isFinalized && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-5 flex gap-3 items-start">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">
              {result?.passed || result?.status === 'passed'
                ? 'Экзамен сдан'
                : 'Экзамен не сдан'}
            </p>
            <p className="text-sm text-emerald-800/90 dark:text-emerald-200/90">
              Балл: {result?.score} / {result?.max_score}
              {result?.percent != null ? ` (${result.percent}%)` : ''}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item, index) => {
          const key = item.question_snapshot_id;
          const selected = item.selected_answer_snapshot_ids || [];
          const options = item.answer_options || [];

          return (
            <Card key={key || index} className="p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Вопрос {index + 1}
                  {item.section_key ? ` · ${item.section_key}` : ''}
                </p>
                <span className="text-xs text-slate-500">
                  {QUESTION_TYPE_LABEL[item.type] || item.type} · {item.points} б.
                </span>
              </div>
              <p className="text-base font-medium text-slate-900 dark:text-white whitespace-pre-wrap">
                {item.stem}
              </p>

              {options.length > 0 && (
                <ul className="space-y-1.5">
                  {options.map((a) => {
                    const aid = a.snapshot_id;
                    const isSelected = selected.includes(aid);
                    return (
                      <li
                        key={aid}
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          isSelected
                            ? 'border-brand/40 bg-brand-soft dark:bg-brand-soft/40'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {a.text}
                        {isSelected && (
                          <span className="ml-2 text-xs font-semibold">ответ ученика</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {item.explanation ? (
                <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2 text-sm">
                  <p className="text-xs text-slate-500 mb-1">
                    {item.type === 'speaking'
                      ? 'Критерии проверки'
                      : 'Рекомендуемый ответ / заметки'}
                  </p>
                  <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                    {item.explanation}
                  </p>
                </div>
              ) : null}

              {item.text_answer != null && item.text_answer !== '' && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm">
                  <p className="text-xs text-slate-500 mb-1">Ответ ученика</p>
                  <p className="whitespace-pre-wrap text-slate-900 dark:text-white">
                    {item.text_answer}
                  </p>
                </div>
              )}

              {(item.has_audio || item.audio_url) && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm space-y-2">
                  <p className="text-xs text-slate-500">Устный ответ</p>
                  <ReviewAudioPlayer url={item.audio_url} />
                </div>
              )}

              {!item.requires_manual_review && item.score != null && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Автооценка: {item.score} / {item.points}
                </p>
              )}

              {item.requires_manual_review && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs text-slate-500">Балл (макс. {item.points})</label>
                    <Input
                      type="number"
                      min="0"
                      max={item.points}
                      step="0.5"
                      disabled={isFinalized || saving || finalizing}
                      value={scores[key] ?? ''}
                      onChange={(e) =>
                        setScores((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Комментарий</label>
                    <Textarea
                      rows={2}
                      disabled={isFinalized || saving || finalizing}
                      value={comments[key] ?? ''}
                      onChange={(e) =>
                        setComments((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder="Необязательно"
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {!isFinalized && (
        <div className="sticky bottom-0 -mx-4 sm:mx-0 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur px-4 py-3 safe-pb flex flex-wrap gap-2 justify-end">
          <Button asChild variant="outline">
            <Link to={createPageUrl('TeacherAssessmentReview')}>Назад</Link>
          </Button>
          <Button
            variant="outline"
            disabled={saving || finalizing || manualItems.length === 0}
            onClick={handleSave}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение…
              </>
            ) : (
              'Сохранить оценку'
            )}
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90"
            disabled={saving || finalizing || manualItems.length === 0}
            onClick={handleFinalize}
          >
            {finalizing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Завершение…
              </>
            ) : (
              'Завершить проверку'
            )}
          </Button>
        </div>
      )}

      {isFinalized && (
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link to={createPageUrl('TeacherAssessmentReview')}>Назад</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
