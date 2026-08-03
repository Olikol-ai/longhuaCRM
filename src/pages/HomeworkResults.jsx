import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { QUESTION_TYPE_LABEL, isManualReviewQuestionType } from '@/lib/assessment-admin';
import { userFacingError } from '@/lib/userFacingError';
import AuthenticatedAudio from '@/components/media/AuthenticatedAudio';

const STATUS_LABEL = {
  assigned: 'Назначено',
  started: 'Выполняется',
  in_progress: 'Выполняется',
  submitted: 'На проверке',
  checked: 'Проверено',
  reviewed: 'Проверено',
  expired: 'Просрочено',
  overdue: 'Просрочено',
  cancelled: 'Отменено',
  needs_revision: 'На доработке',
};

function ReviewAudioPlayer({ url }) {
  if (!url) return null;
  return <AuthenticatedAudio src={url} />;
}

export default function HomeworkResults() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const homeworkId = params.get('homeworkId');
  const assignmentId = params.get('assignmentId');
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingLocal, setSavingLocal] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const isTutor = user?.role === 'tutor';

  const applyDetail = (res) => {
    setDetail(res);
    const nextScores = {};
    const nextComments = {};
    const answersByQ = new Map(
      (res?.answers || []).map((a) => [a.question_snapshot_id, a]),
    );
    for (const q of res?.questions || []) {
      if (!isManualReviewQuestionType(q.type)) continue;
      const ans = answersByQ.get(q.id);
      if (ans?.earned_points != null) nextScores[q.id] = String(ans.earned_points);
      if (ans?.review_comment) nextComments[q.id] = ans.review_comment;
    }
    setScores(nextScores);
    setComments(nextComments);
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await api.homework.listAssignments(homeworkId || undefined);
        setRows(Array.isArray(data) ? data : []);
        if (assignmentId) {
          const res = await api.homework.assignmentResult(assignmentId);
          applyDetail(res);
        }
      } catch (err) {
        toast({
          title: 'Ошибка',
          description: userFacingError(err),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [homeworkId, assignmentId]);

  const openResult = async (id) => {
    try {
      const res = await api.homework.assignmentResult(id);
      applyDetail(res);
      navigate(
        `${createPageUrl('HomeworkResults')}?assignmentId=${id}${
          homeworkId ? `&homeworkId=${homeworkId}` : ''
        }`,
        { replace: true },
      );
    } catch (err) {
      toast({
        title: 'Результат недоступен',
        description: userFacingError(err, 'Ученик ещё не сдал задание.'),
        variant: 'destructive',
      });
    }
  };

  const updateLocalStatus = async (status) => {
    if (!detail?.id && !detail?.assignment_id) return;
    const id = detail.assignment_id || detail.id;
    const comment =
      window.prompt('Комментарий преподавателя/репетитора', detail.owner_comment || '') ??
      detail.owner_comment ??
      '';
    const result =
      window.prompt('Результат проверки', detail.review_result || '') ??
      detail.review_result ??
      '';
    setSavingLocal(true);
    try {
      const updated = await api.homework.updateLocalStatus(id, {
        status,
        comment,
        result,
      });
      setDetail((prev) => ({
        ...prev,
        ...updated,
        result: {
          ...(prev?.result || {}),
          manual: true,
          status: updated.manual_status || updated.status,
          review_result: updated.review_result,
          owner_comment: updated.owner_comment,
        },
      }));
      setRows((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      toast({ title: 'Статус обновлён' });
    } catch (err) {
      toast({
        title: 'Не удалось обновить статус',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSavingLocal(false);
    }
  };

  const manualQuestions = useMemo(
    () => (detail?.questions || []).filter((q) => isManualReviewQuestionType(q.type)),
    [detail],
  );

  const answersByQ = useMemo(() => {
    const map = new Map();
    for (const a of detail?.answers || []) {
      map.set(a.question_snapshot_id, a);
    }
    return map;
  }, [detail]);

  const needsManualReview =
    detail?.result?.status === 'pending_review' ||
    (manualQuestions.length > 0 && detail?.result?.status === 'pending_review');

  const assignmentKey = detail?.assignment_id || params.get('assignmentId');

  const buildReviewPayload = () =>
    manualQuestions.map((q) => {
      const raw = scores[q.id];
      if (raw === undefined || raw === '') {
        throw new Error('Укажите балл для всех заданий на проверку');
      }
      const score = Number(raw);
      if (Number.isNaN(score) || score < 0 || score > Number(q.points)) {
        throw new Error(`Балл для задания должен быть от 0 до ${q.points}`);
      }
      return {
        question_snapshot_id: q.id,
        score,
        comment: comments[q.id]?.trim() || null,
      };
    });

  const handleSaveReview = async () => {
    if (!assignmentKey) return;
    setSavingReview(true);
    try {
      const answers = buildReviewPayload();
      const saved = await api.homework.saveReview(assignmentKey, { answers });
      applyDetail(saved);
      toast({ title: 'Оценки сохранены' });
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSavingReview(false);
    }
  };

  const handleFinalizeReview = async () => {
    if (!assignmentKey) return;
    setFinalizing(true);
    try {
      const answers = buildReviewPayload();
      await api.homework.saveReview(assignmentKey, { answers });
      const finalized = await api.homework.finalizeReview(assignmentKey);
      applyDetail(finalized);
      toast({ title: 'Проверка завершена' });
      const data = await api.homework.listAssignments(homeworkId || undefined);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({
        title: 'Не удалось завершить проверку',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setFinalizing(false);
    }
  };

  const clearDetail = () => {
    setDetail(null);
    navigate(
      `${createPageUrl('HomeworkResults')}${
        homeworkId ? `?homeworkId=${encodeURIComponent(homeworkId)}` : ''
      }`,
      { replace: true },
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const detailPanel = !detail ? (
    <p className="text-sm text-slate-500 hidden md:block">
      Выберите назначение, чтобы увидеть результат.
    </p>
  ) : (
    <div className="space-y-3 min-w-0" data-testid="homework-result-detail">
      <div className="md:hidden">
        <Button variant="outline" className="w-full mb-2" onClick={clearDetail}>
          ← К назначениям
        </Button>
      </div>
      <h2 className="font-semibold text-lg break-words">{detail.title}</h2>
      <p className="text-sm text-slate-500 break-words">
        {detail.owner_type === 'tutor' ? 'Репетитор' : 'Преподаватель'}:{' '}
        {detail.owner_name || '—'}
      </p>
      <p className="text-sm break-words">
        Ученик: <strong>{detail.learner_name || '—'}</strong>
      </p>
      <p className="text-sm">
        Статус:{' '}
        <strong>{STATUS_LABEL[detail.status] || detail.status || '—'}</strong>
      </p>
      {detail.progress?.total != null && (
        <p className="text-sm">
          Прогресс:{' '}
          <strong>
            {detail.progress.answered ?? 0}/{detail.progress.total} вопросов
          </strong>
        </p>
      )}
      {detail.checked_by_name && (
        <p className="text-sm text-slate-500 break-words">
          Проверил: {detail.checked_by_name}
          {detail.checked_at
            ? ` · ${new Date(detail.checked_at).toLocaleString('ru-RU')}`
            : ''}
        </p>
      )}

      {detail.result?.manual ? (
        <div className="space-y-2 min-w-0">
          <p className="text-sm">
            Статус:{' '}
            <strong>
              {STATUS_LABEL[detail.result.status] || detail.result.status}
            </strong>
          </p>
          <p className="text-sm break-words">
            Результат: {detail.result.review_result || '—'}
          </p>
          <p className="text-sm break-words">
            Комментарий: {detail.result.owner_comment || '—'}
          </p>
        </div>
      ) : detail.result ? (
        <>
          <p className="text-sm">
            Статус:{' '}
            <strong>
              {detail.result.status === 'pending_review'
                ? 'Ожидает проверки'
                : STATUS_LABEL[detail.result.status] || detail.result.status}
            </strong>
          </p>
          <p className="text-sm">
            Баллы: <strong>{detail.result.score}</strong> / {detail.result.max_score}
            {detail.result.status === 'pending_review' ? ' (предварительно)' : ''}
          </p>
          <p className="text-sm">
            Процент: <strong>{detail.result.percent}%</strong>
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">Ещё нет результата.</p>
      )}

      {(detail.questions || []).length > 0 && (
        <div className="border-t pt-3 space-y-4 min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-400">
            Ответы ученика
          </p>
          {(detail.questions || []).map((q, index) => {
            const ans = answersByQ.get(q.id);
            const manual = isManualReviewQuestionType(q.type);
            return (
              <div
                key={q.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 min-w-0 overflow-hidden"
              >
                <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                  <span className="break-words min-w-0">
                    Вопрос {index + 1} · {QUESTION_TYPE_LABEL[q.type] || q.type}
                  </span>
                  <span className="shrink-0">{q.points} б.</span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words font-medium">{q.stem}</p>
                {q.explanation && (
                  <p className="text-xs text-slate-500 whitespace-pre-wrap break-words">
                    Для проверяющего: {q.explanation}
                  </p>
                )}
                {ans?.text ? (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm whitespace-pre-wrap break-words">
                    {ans.text}
                  </div>
                ) : null}
                {ans?.has_audio || ans?.audio_url ? (
                  <div className="max-w-full overflow-hidden">
                    <ReviewAudioPlayer url={ans.audio_url} />
                  </div>
                ) : null}
                {!manual && ans?.is_correct === true && (
                  <span className="text-sm text-emerald-600">✓ верно</span>
                )}
                {!manual && ans?.is_correct === false && (
                  <span className="text-sm text-red-600">✗ ошибка</span>
                )}
                {manual && needsManualReview && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="min-w-0">
                      <label className="text-xs text-slate-500">
                        Балл (макс. {q.points})
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max={q.points}
                        step="0.5"
                        value={scores[q.id] ?? ''}
                        onChange={(e) =>
                          setScores((prev) => ({
                            ...prev,
                            [q.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="text-xs text-slate-500">Комментарий</label>
                      <Textarea
                        rows={2}
                        className="text-base md:text-sm"
                        value={comments[q.id] ?? ''}
                        onChange={(e) =>
                          setComments((prev) => ({
                            ...prev,
                            [q.id]: e.target.value,
                          }))
                        }
                        placeholder="Например: отличная работа"
                      />
                    </div>
                  </div>
                )}
                {manual && !needsManualReview && ans?.earned_points != null && (
                  <p className="text-sm text-slate-600 break-words">
                    Оценка: {ans.earned_points} / {q.points}
                    {ans.review_comment ? ` · ${ans.review_comment}` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {needsManualReview && manualQuestions.length > 0 && (
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 border-t pt-3">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={savingReview || finalizing}
            onClick={handleSaveReview}
          >
            {savingReview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Сохранить оценку'
            )}
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={savingReview || finalizing}
            onClick={handleFinalizeReview}
          >
            {finalizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Завершить проверку'
            )}
          </Button>
        </div>
      )}

      {isTutor &&
        detail.learner_type === 'tutor_student' &&
        detail.learner_has_account === false && (
          <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={savingLocal}
              onClick={() => updateLocalStatus('completed')}
            >
              Отметить выполнено
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={savingLocal}
              onClick={() => updateLocalStatus('not_completed')}
            >
              Отметить не выполнено
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={savingLocal}
              onClick={() => updateLocalStatus('checked')}
            >
              Проверено
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={savingLocal}
              onClick={() => updateLocalStatus('needs_revision')}
            >
              На доработку
            </Button>
          </div>
        )}
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => navigate(createPageUrl('HomeworkList'))}
      >
        К списку заданий
      </Button>
    </div>
  );

  return (
    <div
      className="p-3 sm:p-6 w-full max-w-5xl mx-auto space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden"
      data-testid="homework-results"
    >
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold break-words">Результаты домашних заданий</h1>
        <p className="text-sm text-slate-500 mt-1 break-words">
          Баллы, проверка текстовых и Speaking-ответов
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        <div className={`space-y-2 min-w-0 ${detail ? 'hidden md:block' : ''}`}>
          {rows.length === 0 && (
            <p className="text-sm text-slate-500">Назначений пока нет.</p>
          )}
          {rows.map((a) => {
            const active = detail && (detail.assignment_id === a.id || detail.id === a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => openResult(a.id)}
                className={`w-full text-left bg-white dark:bg-slate-900 border rounded-xl p-3 sm:p-4 min-h-11 hover:border-brand/40 min-w-0 ${
                  active ? 'border-brand/50 ring-1 ring-brand/20' : ''
                }`}
              >
                <div className="font-medium break-words">{a.title || 'Задание'}</div>
                <div className="text-xs text-slate-500 mt-1 break-words">
                  {a.learner_name ? `${a.learner_name} · ` : ''}
                  {STATUS_LABEL[a.status] || a.status}
                  {a.due_at ? ` · срок ${new Date(a.due_at).toLocaleString('ru-RU')}` : ''}
                  {a.owner_name
                    ? ` · ${a.owner_type === 'tutor' ? 'Репетитор' : 'Преподаватель'}: ${a.owner_name}`
                    : ''}
                </div>
              </button>
            );
          })}
        </div>

        <div
          className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 sm:p-5 min-h-[200px] space-y-4 min-w-0 overflow-x-hidden ${
            !detail ? 'hidden md:block' : ''
          }`}
        >
          {detailPanel}
        </div>
      </div>
    </div>
  );
}
