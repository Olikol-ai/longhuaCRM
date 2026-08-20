import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import {
  Button,
  Card,
  CardContent,
  Caption,
  Input,
  Label,
  NumberInput,
  Spinner,
  Textarea,
} from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { QUESTION_TYPE_LABEL, isManualReviewQuestionType } from '@/lib/assessment-admin';
import {
  computeAutoHomeworkPercent,
  normalizeHomeworkGradingMode,
  sumHomeworkItemPoints,
} from '@/lib/homework-grading';
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

function selectedAnswerText(question, answer) {
  const ids = new Set(answer?.selected_answer_snapshot_ids || []);
  if (!ids.size) return null;
  const labels = (question.answers || [])
    .filter((option) => ids.has(option.id) || ids.has(option.snapshot_id))
    .map((option) => option.text || option.body)
    .filter(Boolean);
  return labels.length ? labels.join(', ') : null;
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
  const [gradingMode, setGradingMode] = useState('auto');
  const [manualPercent, setManualPercent] = useState('');
  const [studentFeedback, setStudentFeedback] = useState('');
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const isTutor = user?.role === 'tutor';

  const applyDetail = (res) => {
    setDetail(res);
    const nextScores = {};
    const nextComments = {};
    const answersByQ = new Map(
      (res?.answers || []).map((a) => [a.question_snapshot_id, a]),
    );
    for (const q of res?.questions || []) {
      const ans = answersByQ.get(q.id);
      if (ans?.earned_points != null) nextScores[q.id] = String(ans.earned_points);
      if (ans?.review_comment) nextComments[q.id] = ans.review_comment;
    }
    setScores(nextScores);
    setComments(nextComments);
    const mode = normalizeHomeworkGradingMode(res?.result?.grading_mode);
    setGradingMode(mode);
    const storedManual = res?.result?.manual_percentage;
    setManualPercent(
      storedManual != null && storedManual !== ''
        ? String(storedManual)
        : res?.result?.percent != null
          ? String(res.result.percent)
          : '',
    );
    setStudentFeedback(
      res?.result?.student_feedback ||
        res?.student_feedback ||
        res?.owner_comment ||
        '',
    );
    setShowCorrectAnswers(Boolean(res?.result?.show_correct_answers));
    setExpandedId((current) => current || res?.questions?.[0]?.id || null);
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
      setExpandedId(res?.questions?.[0]?.id || null);
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
      window.prompt('Комментарий преподавателя/репетитора', studentFeedback || detail.owner_comment || '') ??
      studentFeedback ??
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
          student_feedback: updated.owner_comment,
        },
      }));
      setStudentFeedback(updated.owner_comment || '');
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

  const questions = detail?.questions || [];

  const answersByQ = useMemo(() => {
    const map = new Map();
    for (const a of detail?.answers || []) {
      map.set(a.question_snapshot_id, a);
    }
    return map;
  }, [detail]);

  const needsReview = detail?.result?.status === 'pending_review';
  const assignmentKey = detail?.assignment_id || params.get('assignmentId');
  const pointTotals = sumHomeworkItemPoints(questions, scores, answersByQ);
  const autoPercent = computeAutoHomeworkPercent(pointTotals.earned, pointTotals.max);
  const displayedPercent =
    gradingMode === 'manual'
      ? manualPercent === ''
        ? '—'
        : manualPercent
      : autoPercent;

  const selectGradingMode = (mode) => {
    if (mode === 'manual' && (manualPercent === '' || manualPercent == null)) {
      setManualPercent(String(autoPercent));
    }
    setGradingMode(mode);
  };

  const buildReviewPayload = () => {
    const answers = [];
    for (const q of questions) {
      const raw = scores[q.id];
      const existing = answersByQ.get(q.id)?.earned_points;
      const value =
        raw !== undefined && raw !== '' ? Number(raw) : existing == null ? NaN : Number(existing);
      if (isManualReviewQuestionType(q.type) && (raw === undefined || raw === '' || Number.isNaN(value))) {
        throw new Error('Укажите балл для всех заданий на проверку');
      }
      if (Number.isNaN(value)) continue;
      if (value < 0 || value > Number(q.points)) {
        throw new Error(`Балл для задания должен быть от 0 до ${q.points}`);
      }
      answers.push({
        question_snapshot_id: q.id,
        score: value,
        comment: comments[q.id]?.trim() || null,
      });
    }
    if (gradingMode === 'manual') {
      const percent = Number(manualPercent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new Error('Укажите итоговый процент от 0 до 100');
      }
    }
    return {
      answers,
      grading_mode: gradingMode,
      manual_percentage: gradingMode === 'manual' ? Number(manualPercent) : undefined,
      student_feedback: studentFeedback.trim() || null,
      show_correct_answers: showCorrectAnswers,
    };
  };

  const handleSaveReview = async () => {
    if (!assignmentKey) return;
    setSavingReview(true);
    try {
      const saved = await api.homework.saveReview(assignmentKey, buildReviewPayload());
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
      const payload = buildReviewPayload();
      const finalized = await api.homework.finalizeReview(assignmentKey, payload);
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
    setExpandedId(null);
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
        <Spinner />
      </div>
    );
  }

  const reviewActions = needsReview ? (
    <div className="flex flex-col sm:flex-row flex-wrap gap-2">
      <Button
        intent="outline"
        className="w-full sm:w-auto min-h-11"
        disabled={savingReview || finalizing}
        loading={savingReview}
        onClick={handleSaveReview}
      >
        Сохранить оценку
      </Button>
      <Button
        className="w-full sm:w-auto min-h-11"
        disabled={savingReview || finalizing}
        loading={finalizing}
        onClick={handleFinalizeReview}
      >
        Завершить проверку
      </Button>
    </div>
  ) : null;

  const detailPanel = !detail ? null : (
    <div className="space-y-4 min-w-0" data-testid="homework-result-detail">
      <Button intent="outline" className="w-full sm:w-auto min-h-11" onClick={clearDetail}>
        ← К назначениям
      </Button>
      <h2 className="font-semibold text-lg break-words">{detail.title}</h2>
      <Caption className="break-words">
        {detail.owner_type === 'tutor' ? 'Репетитор' : 'Преподаватель'}:{' '}
        {detail.owner_name || '—'}
      </Caption>
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
        <Caption className="break-words">
          Проверил: {detail.checked_by_name}
          {detail.checked_at
            ? ` · ${new Date(detail.checked_at).toLocaleString('ru-RU')}`
            : ''}
        </Caption>
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
        <Card>
          <CardContent className="space-y-4 pt-6 min-w-0">
            <p className="text-sm">
              Статус:{' '}
              <strong>
                {detail.result.status === 'pending_review'
                  ? 'Ожидает проверки'
                  : STATUS_LABEL[detail.result.status] || detail.result.status}
              </strong>
            </p>
            <p className="text-sm">
              Баллы заданий:{' '}
              <strong>
                {pointTotals.earned} / {pointTotals.max}
              </strong>
              {needsReview ? ' (можно уточнить ниже)' : ''}
            </p>

            <div className="space-y-2" data-testid="homework-overall-percent">
              <Label htmlFor="homework-manual-percent">Выполнение</Label>
              <div className="flex items-center gap-2 max-w-xs">
                {gradingMode === 'manual' ? (
                  <NumberInput
                    id="homework-manual-percent"
                    data-testid="homework-manual-percent"
                    min="0"
                    max="100"
                    step="1"
                    className="min-h-11"
                    disabled={!needsReview}
                    value={manualPercent}
                    onChange={(e) => setManualPercent(e.target.value)}
                  />
                ) : (
                  <Input
                    id="homework-manual-percent"
                    data-testid="homework-auto-percent"
                    readOnly
                    className="min-h-11"
                    value={displayedPercent}
                  />
                )}
                <span className="text-sm shrink-0">%</span>
              </div>
            </div>

            <fieldset className="space-y-1" data-testid="homework-grading-mode">
              <legend className="text-sm font-medium">Режим</legend>
              <label className="flex items-center gap-3 min-h-11 cursor-pointer">
                <input
                  type="radio"
                  name="homework-grading-mode"
                  className="size-5"
                  checked={gradingMode === 'manual'}
                  disabled={!needsReview}
                  onChange={() => selectGradingMode('manual')}
                />
                <span>Вручную</span>
              </label>
              <label className="flex items-center gap-3 min-h-11 cursor-pointer">
                <input
                  type="radio"
                  name="homework-grading-mode"
                  className="size-5"
                  checked={gradingMode === 'auto'}
                  disabled={!needsReview}
                  onChange={() => selectGradingMode('auto')}
                />
                <span>Автоматически</span>
              </label>
              <Caption>
                {gradingMode === 'manual'
                  ? 'Итоговый процент не пересчитывается при изменении баллов за отдельные задания.'
                  : 'Процент = сумма полученных баллов / сумма максимумов × 100. Сложность задания на процент не влияет.'}
              </Caption>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="homework-student-feedback">Комментарий ученику</Label>
              <Textarea
                id="homework-student-feedback"
                data-testid="homework-student-feedback"
                rows={3}
                className="text-base"
                disabled={!needsReview}
                value={studentFeedback}
                onChange={(e) => setStudentFeedback(e.target.value)}
                placeholder="Этот текст увидит ученик после проверки"
              />
            </div>

            <label className="flex items-start gap-3 min-h-11 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 size-5"
                data-testid="homework-show-correct"
                disabled={!needsReview}
                checked={showCorrectAnswers}
                onChange={(e) => setShowCorrectAnswers(e.target.checked)}
              />
              <span className="text-sm">
                Показывать правильный ответ ученику после проверки
              </span>
            </label>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Ещё нет результата.</p>
      )}

      {questions.length > 0 && (
        <div
          className="border-t pt-3 space-y-2 min-w-0"
          data-testid="homework-review-accordion"
        >
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Задания
          </p>
          {questions.map((q, index) => {
            const ans = answersByQ.get(q.id);
            const open = expandedId === q.id;
            const selectedText = selectedAnswerText(q, ans);
            const earned =
              scores[q.id] !== undefined && scores[q.id] !== ''
                ? scores[q.id]
                : ans?.earned_points ?? '';
            return (
              <div
                key={q.id}
                className="rounded-xl border border-border min-w-0 overflow-hidden"
                data-testid={`homework-review-item-${index}`}
              >
                <button
                  type="button"
                  className="w-full min-h-11 flex items-center gap-2 px-3 py-3 text-left"
                  aria-expanded={open}
                  onClick={() => setExpandedId(open ? null : q.id)}
                >
                  {open ? (
                    <ChevronDown className="size-5 shrink-0" aria-hidden />
                  ) : (
                    <ChevronRight className="size-5 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 break-words font-medium">
                    Задание {index + 1}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {QUESTION_TYPE_LABEL[q.type] || q.type}
                      {earned !== '' ? ` · ${earned} / ${q.points}` : ` · макс. ${q.points}`}
                    </span>
                  </span>
                </button>
                {open && (
                  <div className="border-t px-3 pb-3 pt-3 space-y-3 min-w-0">
                    <p className="text-sm whitespace-pre-wrap break-words">{q.stem}</p>
                    {q.explanation && (
                      <p
                        className="text-xs text-muted-foreground whitespace-pre-wrap break-words"
                        data-testid="homework-reviewer-expected-answer"
                      >
                        Эталонный ответ для проверяющего (ученик не видит его автоматически):{' '}
                        {q.explanation}
                      </p>
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                        Ответ ученика
                      </p>
                      {ans?.text ? (
                        <div className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap break-words">
                          {ans.text}
                        </div>
                      ) : null}
                      {selectedText ? (
                        <div className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap break-words">
                          {selectedText}
                        </div>
                      ) : null}
                      {ans?.has_audio || ans?.audio_url ? (
                        <div className="max-w-full overflow-hidden">
                          <ReviewAudioPlayer url={ans.audio_url} />
                        </div>
                      ) : null}
                      {!ans?.text && !selectedText && !ans?.has_audio && !ans?.audio_url ? (
                        <p className="text-sm text-muted-foreground">Нет ответа</p>
                      ) : null}
                      {ans?.is_correct === true && (
                        <span className="text-sm text-emerald-600">✓ верно</span>
                      )}
                      {ans?.is_correct === false && (
                        <span className="text-sm text-red-600">✗ ошибка</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="min-w-0">
                        <Label htmlFor={`score-${q.id}`}>
                          Оценка: получено / максимум {q.points}
                        </Label>
                        <NumberInput
                          id={`score-${q.id}`}
                          min="0"
                          max={q.points}
                          step="0.5"
                          className="min-h-11 mt-1"
                          disabled={!needsReview}
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
                        <Label htmlFor={`comment-${q.id}`}>Комментарий ученику</Label>
                        <Textarea
                          id={`comment-${q.id}`}
                          rows={2}
                          className="text-base mt-1"
                          disabled={!needsReview}
                          value={comments[q.id] ?? ''}
                          onChange={(e) =>
                            setComments((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
                          placeholder="Замечание или похвала — ученик увидит после проверки"
                        />
                      </div>
                    </div>
                    {needsReview && (
                      <Button
                        intent="outline"
                        className="w-full min-h-11"
                        disabled={savingReview || finalizing}
                        loading={savingReview}
                        onClick={handleSaveReview}
                      >
                        Сохранить
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reviewActions && <div className="border-t pt-3">{reviewActions}</div>}

      {isTutor &&
        detail.learner_type === 'tutor_student' &&
        detail.learner_has_account === false && (
          <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              size="sm"
              intent="outline"
              className="w-full min-h-11"
              disabled={savingLocal}
              onClick={() => updateLocalStatus('completed')}
            >
              Отметить выполнено
            </Button>
            <Button
              size="sm"
              intent="outline"
              className="w-full min-h-11"
              disabled={savingLocal}
              onClick={() => updateLocalStatus('not_completed')}
            >
              Отметить не выполнено
            </Button>
            <Button
              size="sm"
              intent="outline"
              className="w-full min-h-11"
              disabled={savingLocal}
              onClick={() => updateLocalStatus('checked')}
            >
              Проверено
            </Button>
            <Button
              size="sm"
              intent="outline"
              className="w-full min-h-11"
              disabled={savingLocal}
              onClick={() => updateLocalStatus('needs_revision')}
            >
              На доработку
            </Button>
          </div>
        )}
      <Button
        intent="outline"
        className="w-full sm:w-auto min-h-11"
        onClick={() => navigate(createPageUrl('HomeworkList'))}
      >
        К списку заданий
      </Button>
    </div>
  );

  return (
    <div
      className="p-3 sm:p-6 w-full max-w-3xl mx-auto space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden"
      data-testid="homework-results"
    >
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold break-words">Результаты домашних заданий</h1>
        <p className="text-sm text-muted-foreground mt-1 break-words">
          Проверка ответов, баллы и итоговый процент
        </p>
      </div>

      <div className="flex flex-col gap-4 min-w-0" data-testid="homework-review-layout">
        <div className={`space-y-2 min-w-0 ${detail ? 'hidden' : ''}`}>
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Назначений пока нет.</p>
          )}
          {rows.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => openResult(a.id)}
              className="w-full text-left bg-card border rounded-xl p-3 sm:p-4 min-h-11 hover:border-brand/40 min-w-0"
            >
              <div className="font-medium break-words">{a.title || 'Задание'}</div>
              <div className="text-xs text-muted-foreground mt-1 break-words">
                {a.learner_name ? `${a.learner_name} · ` : ''}
                {STATUS_LABEL[a.status] || a.status}
                {a.due_at ? ` · срок ${new Date(a.due_at).toLocaleString('ru-RU')}` : ''}
                {a.owner_name
                  ? ` · ${a.owner_type === 'tutor' ? 'Репетитор' : 'Преподаватель'}: ${a.owner_name}`
                  : ''}
              </div>
            </button>
          ))}
        </div>

        {detail && (
          <div className="bg-card border rounded-2xl p-4 sm:p-5 min-h-[200px] space-y-4 min-w-0 overflow-x-hidden">
            {detailPanel}
          </div>
        )}

        {!detail && (
          <p className="text-sm text-muted-foreground">
            Выберите назначение, чтобы открыть проверку.
          </p>
        )}
      </div>
    </div>
  );
}
