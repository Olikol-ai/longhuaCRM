import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/api';
import { ResultStatusBadge } from '@/components/assessment/StatusBadges';
import AuthenticatedAudio from '@/components/media/AuthenticatedAudio';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import {
  QUESTION_TYPE_LABEL,
  formatDateTime,
  formatDurationSeconds,
} from '@/lib/assessment-admin';

function ReviewAudioPlayer({ url }) {
  if (!url) return null;
  return <AuthenticatedAudio src={url} />;
}

export default function AdminExamAttemptDetail() {
  const [params] = useSearchParams();
  const attemptId = params.get('attemptId') || params.get('id') || '';

  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(Boolean(attemptId));
  const [error, setError] = useState(null);
  const [finalScoreDraft, setFinalScoreDraft] = useState('');
  const [finalScoreReason, setFinalScoreReason] = useState('');
  const [adjustingFinal, setAdjustingFinal] = useState(false);

  const reload = useCallback(async () => {
    if (!attemptId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await api.assessment.adminGetAttemptDetail(attemptId);
      setBundle(payload);
      const score = payload?.result?.score;
      setFinalScoreDraft(score == null || score === '' ? '' : String(score));
    } catch (err) {
      setError(err);
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const result = bundle?.result;
  const items = bundle?.items || [];
  const history = bundle?.score_history || [];
  const canAdjust = Boolean(bundle?.can_adjust_final_score);
  const autoScoreLabel =
    result?.auto_score == null || result?.auto_score === ''
      ? 'не зафиксирован'
      : String(result.auto_score);
  const scoreSourceLabel =
    result?.score_source === 'manual' ? 'вручную' : 'автоматически';
  const isFinalized =
    result?.status === 'passed' || result?.status === 'failed';

  const handleAdjustFinalScore = async () => {
    if (!result?.id || !canAdjust) return;
    const maxScore = Number(result.max_score);
    const next = Number(finalScoreDraft);
    if (Number.isNaN(next)) {
      toast({
        title: 'Некорректный балл',
        description: 'Введите число',
        variant: 'destructive',
      });
      return;
    }
    if (next < 0 || next > maxScore) {
      toast({
        title: 'Балл вне диапазона',
        description: `Допустимо от 0 до ${maxScore}`,
        variant: 'destructive',
      });
      return;
    }
    const current = Number(result.score);
    if (next === current) {
      toast({ title: 'Итоговый балл не изменился' });
      return;
    }
    const confirmed = window.confirm(
      `Изменить итоговый балл с ${result.score} на ${next} (из ${maxScore})?\n` +
        'Баллы за отдельные вопросы не изменятся.',
    );
    if (!confirmed) return;

    setAdjustingFinal(true);
    try {
      await api.assessment.adjustResultFinalScore(result.id, {
        score: next,
        expected_score: current,
        reason: finalScoreReason.trim() || null,
      });
      await reload();
      toast({ title: 'Итоговый балл сохранён' });
      setFinalScoreReason('');
    } catch (err) {
      const message = err?.message || 'Попробуйте ещё раз';
      const isConflict =
        err?.status === 409 ||
        /concurrently|конфликт|reload and try again/i.test(String(message));
      toast({
        title: isConflict
          ? 'Балл уже изменён'
          : 'Не удалось изменить итоговый балл',
        description: isConflict
          ? 'Данные устарели. Страница будет обновлена.'
          : message,
        variant: 'destructive',
      });
      if (isConflict) await reload().catch(() => undefined);
    } finally {
      setAdjustingFinal(false);
    }
  };

  if (!attemptId) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <p>Не указана попытка.</p>
        <Button asChild variant="outline">
          <Link to={createPageUrl('AdminExamRegistry')}>К реестру</Link>
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
        <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200">
          {error?.message || 'Не удалось открыть попытку'}
        </div>
        <Button asChild variant="outline">
          <Link to={createPageUrl('AdminExamRegistry')}>Назад</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 pb-28 min-w-0 overflow-x-hidden"
      data-testid="admin-exam-attempt-detail"
    >
      <div>
        <Link
          to={createPageUrl('AdminExamRegistry')}
          className="text-xs text-muted-foreground hover:text-brand"
        >
          ← Реестр экзаменов
        </Link>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="text-2xl font-bold text-foreground break-words">
            {bundle.exam?.name || 'Экзамен'}
          </h1>
          {result?.status ? <ResultStatusBadge status={result.status} /> : null}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {bundle.student?.name || '—'} · попытка #
          {bundle.attempt?.attempt_number}
        </p>
      </div>

      <Card className="p-4 sm:p-5 space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Автор экзамена: </span>
          {bundle.exam?.created_by_name || '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Назначил: </span>
          {bundle.assignment?.assigned_by_name || '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Статус попытки: </span>
          {bundle.attempt?.status}
        </p>
        <p>
          <span className="text-muted-foreground">Начало: </span>
          {formatDateTime(bundle.attempt?.started_at || result?.started_at)}
        </p>
        <p>
          <span className="text-muted-foreground">Сдача: </span>
          {formatDateTime(bundle.attempt?.submitted_at || result?.finished_at)}
        </p>
        <p>
          <span className="text-muted-foreground">Длительность: </span>
          {formatDurationSeconds(result?.duration)}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild variant="outline" size="sm">
            <Link
              to={`${createPageUrl('AssessmentExamDetail')}?id=${bundle.exam?.id}`}
            >
              Настройки экзамена
            </Link>
          </Button>
          {bundle.assignment?.id ? (
            <Button asChild variant="outline" size="sm">
              <Link
                to={`${createPageUrl('AssessmentAssignmentDetail')}?id=${bundle.assignment.id}`}
              >
                Назначение
              </Link>
            </Button>
          ) : null}
        </div>
      </Card>

      {result && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-4">
          <div className="flex gap-3 items-start">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                {result.passed || result.status === 'passed'
                  ? 'Экзамен сдан'
                  : result.status === 'pending_review'
                    ? 'Ожидает проверки'
                    : 'Экзамен не сдан / в обработке'}
              </p>
              <p className="text-sm text-emerald-800/90 dark:text-emerald-200/90">
                Окончательный балл: {result.score} / {result.max_score}
                {result.percent != null ? ` (${result.percent}%)` : ''}
                {' · '}источник: {scoreSourceLabel}
              </p>
              <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">
                Автоматический балл: {autoScoreLabel}
                {result.max_score != null ? ` / ${result.max_score}` : ''}
              </p>
            </div>
          </div>

          {canAdjust && isFinalized && (
            <div
              className="rounded-xl border border-emerald-200/80 dark:border-emerald-800 bg-white/70 dark:bg-slate-950/40 p-4 space-y-3"
              data-testid="admin-adjust-final-score"
            >
              <p className="text-sm font-medium text-foreground">
                Изменить только итоговый балл
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">
                    Итоговый балл (макс. {result.max_score})
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max={result.max_score}
                    step="0.01"
                    disabled={adjustingFinal}
                    value={finalScoreDraft}
                    onChange={(e) => setFinalScoreDraft(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    Причина (необязательно)
                  </label>
                  <Input
                    disabled={adjustingFinal}
                    value={finalScoreReason}
                    onChange={(e) => setFinalScoreReason(e.target.value)}
                    placeholder="Кратко, для журнала"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  className="bg-primary hover:bg-primary/90"
                  disabled={adjustingFinal}
                  onClick={handleAdjustFinalScore}
                >
                  {adjustingFinal ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Сохранение…
                    </>
                  ) : (
                    'Сохранить итоговый балл'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <Card className="p-4 sm:p-5 space-y-3" data-testid="admin-score-history">
          <h2 className="font-semibold text-foreground">
            История корректировок итога
          </h2>
          <ul className="space-y-2 text-sm">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-border px-3 py-2"
              >
                <p className="font-medium text-foreground">
                  {entry.old_score ?? '—'} → {entry.new_score ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.actor_name} · {formatDateTime(entry.created_at)}
                  {entry.reason ? ` · ${entry.reason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="space-y-4">
        <h2 className="font-semibold text-foreground">Разбор по вопросам</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {bundle.attempt?.status === 'submitted'
              ? 'Детализация ответов пока недоступна.'
              : 'Попытка не завершена — показаны только сохранённые данные (если есть).'}
          </p>
        ) : (
          items.map((item, index) => {
            const key = item.question_snapshot_id || index;
            const selected = item.selected_answer_snapshot_ids || [];
            const options = item.answer_options || [];
            return (
              <Card key={key} className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Вопрос {index + 1}
                    {item.section_key ? ` · ${item.section_key}` : ''}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {QUESTION_TYPE_LABEL[item.type] || item.type} · {item.points}{' '}
                    б.
                  </span>
                </div>
                <p className="text-base font-medium text-foreground whitespace-pre-wrap">
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
                              : 'border-border'
                          }`}
                        >
                          {a.text}
                          {isSelected && (
                            <span className="ml-2 text-xs font-semibold">
                              ответ ученика
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {item.explanation ? (
                  <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">
                      Критерии / пояснение
                    </p>
                    <p className="whitespace-pre-wrap">{item.explanation}</p>
                  </div>
                ) : null}

                {item.text_answer != null && item.text_answer !== '' && (
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">
                      Ответ ученика
                    </p>
                    <p className="whitespace-pre-wrap">{item.text_answer}</p>
                  </div>
                )}

                {(item.has_audio || item.audio_url) && (
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm space-y-2">
                    <p className="text-xs text-muted-foreground">Устный ответ</p>
                    <ReviewAudioPlayer url={item.audio_url} />
                  </div>
                )}

                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    Балл: {item.score != null ? item.score : '—'} / {item.points}
                    {item.is_correct == null
                      ? ''
                      : item.is_correct
                        ? ' · верно'
                        : ' · неверно'}
                  </p>
                  <p>
                    Проверка:{' '}
                    {item.requires_manual_review
                      ? item.score == null
                        ? 'ожидает ручной проверки'
                        : 'проверена вручную'
                      : 'автоматическая'}
                  </p>
                  {item.review_comment ? (
                    <p>Комментарий: {item.review_comment}</p>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
