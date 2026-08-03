import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileQuestion,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { api } from '@/api';
import { assessment } from '@/api/assessment.api';
import QuestionCard from '@/components/assessment/QuestionCard';
import { ExamItemRenderer } from '@/components/hsk-academy/items/itemRegistry';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { stopAllLearningAudio } from '@/lib/learning-audio-runtime';
import {
  LIFECYCLE_STATUS_LABEL,
  QUESTION_TYPE_LABEL,
} from '@/lib/assessment-admin';
import { contentStatusLabel, itemTypeLabel } from '@/lib/examContentLabels';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

function sortedAnswers(answers = []) {
  return [...answers].sort((a, b) => (a.sort_order ?? a.sortOrder ?? 0) - (b.sort_order ?? b.sortOrder ?? 0));
}

function isCorrectAnswer(a) {
  return Boolean(a?.is_correct ?? a?.isCorrect);
}

function answerText(a) {
  return a?.text || a?.body || '';
}

/** Normalize Assessment GET detail for QuestionCard. */
function toAssessmentStudentQuestion(detail) {
  if (!detail) return null;
  return {
    ...detail,
    answers: sortedAnswers(detail.answers || []).map((a) => ({
      ...a,
      id: a.id,
      text: answerText(a),
      is_correct: isCorrectAnswer(a),
    })),
    attachments: Array.isArray(detail.attachments)
      ? detail.attachments.map((att) => ({
          ...att,
          url:
            att.url ||
            (att.id ? assessment.downloadAttachmentUrl(att.id, 'inline') : null),
        }))
      : [],
  };
}

/** Normalize Exam Content GET { item, question } for ExamItemRenderer. */
function toExamContentStudentQuestion(payload) {
  if (!payload) return null;
  const item = payload.item || {};
  const question = payload.question || {};
  const answers = sortedAnswers(question.answers || []).map((a, idx) => ({
    id: a.id || `opt-${idx}`,
    text: answerText(a),
    is_correct: isCorrectAnswer(a),
    sort_order: a.sort_order ?? a.sortOrder ?? idx,
  }));

  const engineAttachments = Array.isArray(question.attachments)
    ? question.attachments.map((att) => ({
        ...att,
        kind: att.kind,
        url:
          att.url ||
          (att.id ? assessment.downloadAttachmentUrl(att.id, 'inline') : null),
      }))
    : [];

  const mediaRows = Array.isArray(item.media) ? item.media : [];
  const mediaAttachments = mediaRows
    .map((row, idx) => {
      const asset = row.asset || row;
      const kind = String(asset.kind || row.kind || '').toLowerCase();
      const storageKey = asset.storage_key || asset.storageKey || '';
      const url =
        asset.url ||
        (storageKey.startsWith('http://') || storageKey.startsWith('https://') || storageKey.startsWith('/')
          ? storageKey
          : null);
      if (!url && !kind) return null;
      return {
        id: row.id || asset.id || `media-${idx}`,
        kind: kind || 'audio',
        url,
      };
    })
    .filter(Boolean);

  const attachments = [...engineAttachments, ...mediaAttachments.filter((m) => m.url)];

  return {
    id: item.id,
    stem: question.stem || item.stem_search || item.stemSearch || '',
    type: item.item_type_code || item.itemTypeCode || question.type || 'single_choice',
    itemTypeCode: item.item_type_code || item.itemTypeCode || 'single_choice',
    explanation: question.explanation || null,
    answers,
    attachments,
    passage_text: question.passage_text || question.passageText || item.passage_text || null,
    vocabulary: item.vocabulary || [],
    status: item.status,
    difficulty: item.difficulty ?? question.difficulty,
    topic: item.topic,
    section_key: item.section_key || item.sectionKey,
    version_id: item.version_id || item.versionId,
    level_id: item.level_id || item.levelId,
    raw: payload,
  };
}

function CorrectAnswerPanel({ bank, detail }) {
  if (!detail) return null;

  if (bank === 'assessment') {
    const answers = sortedAnswers(detail.answers || []);
    const correct = answers.filter(isCorrectAnswer);
    const needsOptions = ['single_choice', 'multiple_choice', 'listening', 'reading'].includes(
      detail.type,
    );
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 space-y-3">
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
          Правильный ответ
        </p>
        {needsOptions ? (
          correct.length ? (
            <ul className="space-y-1.5">
              {correct.map((a) => (
                <li
                  key={a.id || answerText(a)}
                  className="text-sm rounded-lg border border-emerald-300/70 dark:border-emerald-800 bg-white/70 dark:bg-slate-950/40 px-3 py-2"
                >
                  {answerText(a)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Правильный вариант не отмечен.</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            Этот тип проверяется вручную — эталонного варианта в банке нет.
          </p>
        )}
        {detail.explanation ? (
          <div>
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200 mb-1">
              Объяснение
            </p>
            <p className="text-sm whitespace-pre-wrap text-slate-800 dark:text-slate-100">
              {detail.explanation}
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  const answers = sortedAnswers(detail.answers || []);
  const correct = answers.filter(isCorrectAnswer);
  const vocab = detail.vocabulary || [];

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 space-y-3">
      <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
        Правильный ответ
      </p>
      {correct.length ? (
        <ul className="space-y-1.5">
          {correct.map((a) => (
            <li
              key={a.id || answerText(a)}
              className="text-sm rounded-lg border border-emerald-300/70 dark:border-emerald-800 bg-white/70 dark:bg-slate-950/40 px-3 py-2"
            >
              {answerText(a)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Правильный вариант не отмечен.</p>
      )}
      {detail.explanation ? (
        <div>
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200 mb-1">
            Объяснение
          </p>
          <p className="text-sm whitespace-pre-wrap">{detail.explanation}</p>
        </div>
      ) : null}
      {vocab.length ? (
        <div>
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200 mb-1">
            Новые слова
          </p>
          <ul className="space-y-1 text-sm">
            {vocab.map((v, i) => (
              <li key={`${v.word}-${i}`}>
                <span className="font-medium">{v.word}</span>
                {v.pinyin ? <span className="text-muted-foreground"> ({v.pinyin})</span> : null}
                {v.translation ? <> — {v.translation}</> : null}
                {v.explanation ? (
                  <span className="block text-xs text-muted-foreground mt-0.5">{v.explanation}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Teacher preview: student-facing render without leaving the bank list.
 */
export default function QuestionPreviewDialog({
  open,
  onOpenChange,
  bank = 'assessment',
  questionIds = [],
  initialId = null,
  canDelete = false,
  onEdit,
  onRequestDelete,
  onCopied,
  onOpenExamCreate,
}) {
  const navigate = useNavigate();
  const cacheRef = useRef(new Map());
  const [currentId, setCurrentId] = useState(initialId);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [trySelect, setTrySelect] = useState([]);

  const ids = useMemo(
    () => (Array.isArray(questionIds) ? questionIds.filter(Boolean) : []),
    [questionIds],
  );

  const index = useMemo(() => {
    if (!currentId) return -1;
    return ids.indexOf(currentId);
  }, [ids, currentId]);

  const loadDetail = useCallback(
    async (id) => {
      if (!id) return;
      const cached = cacheRef.current.get(id);
      if (cached) {
        setDetail(cached);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let mapped;
        if (bank === 'exam_content') {
          const raw = await api.examContent.items.get(id);
          mapped = toExamContentStudentQuestion(raw);
        } else {
          const raw = await api.assessment.getQuestion(id);
          mapped = toAssessmentStudentQuestion(raw);
        }
        cacheRef.current.set(id, mapped);
        setDetail(mapped);
      } catch (err) {
        setDetail(null);
        setError(userFacingError(err));
      } finally {
        setLoading(false);
      }
    },
    [bank],
  );

  useEffect(() => {
    if (!open) {
      stopAllLearningAudio();
      return;
    }
    setShowCorrect(false);
    setTrySelect([]);
    setCurrentId(initialId);
  }, [open, initialId]);

  useEffect(() => {
    if (!open || !currentId) return;
    setShowCorrect(false);
    setTrySelect([]);
    stopAllLearningAudio();
    void loadDetail(currentId);
  }, [open, currentId, loadDetail]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (index > 0) setCurrentId(ids[index - 1]);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (index >= 0 && index < ids.length - 1) setCurrentId(ids[index + 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, ids]);

  const goPrev = () => {
    if (index > 0) setCurrentId(ids[index - 1]);
  };
  const goNext = () => {
    if (index >= 0 && index < ids.length - 1) setCurrentId(ids[index + 1]);
  };

  const handleCopy = async () => {
    if (!detail) return;
    setBusyAction('copy');
    try {
      if (bank === 'assessment') {
        const body = {
          type: detail.type,
          stem: detail.stem,
          points: Number(detail.points) || 1,
          difficulty: detail.difficulty ?? 1,
          explanation: detail.explanation || null,
          answers: sortedAnswers(detail.answers || [])
            .filter((a) => answerText(a).trim())
            .map((a, i) => ({
              text: answerText(a).trim(),
              is_correct: isCorrectAnswer(a),
              sort_order: i,
            })),
        };
        const created = await api.assessment.createQuestion(body);
        toast({ title: 'Копия создана как черновик' });
        onCopied?.(created);
        onOpenChange(false);
        onEdit?.(created, 'edit');
      } else {
        const created = await api.examContent.items.create({
          version_id: detail.version_id,
          level_id: detail.level_id,
          section_key: detail.section_key || 'reading',
          topic: detail.topic || null,
          difficulty: Number(detail.difficulty) || 1,
          stem: detail.stem,
          explanation: detail.explanation || null,
          options: sortedAnswers(detail.answers || [])
            .filter((a) => answerText(a).trim())
            .map((a) => ({
              text: answerText(a).trim(),
              is_correct: isCorrectAnswer(a),
            })),
          vocabulary: (detail.vocabulary || [])
            .filter((v) => v.word?.trim())
            .map((v) => ({
              word: v.word,
              pinyin: v.pinyin || '',
              translation: v.translation || '',
              explanation: v.explanation || undefined,
            })),
        });
        toast({ title: 'Копия создана как черновик' });
        const newId = created?.item?.id || created?.id;
        onCopied?.(created);
        onOpenChange(false);
        if (newId) onEdit?.(newId);
      }
    } catch (err) {
      toast({
        title: 'Не удалось скопировать',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const statusLabel =
    bank === 'assessment'
      ? LIFECYCLE_STATUS_LABEL[detail?.status] || detail?.status
      : contentStatusLabel(detail?.status);

  const typeLabel =
    bank === 'assessment'
      ? QUESTION_TYPE_LABEL[detail?.type] || detail?.type
      : itemTypeLabel(detail?.itemTypeCode || detail?.type);

  const isPublished = detail?.status === 'published';
  const showUseActions = bank === 'assessment' && isPublished;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[min(92vh,calc(100dvh-1rem))] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border shrink-0 pr-12">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
            <FileQuestion className="h-4 w-4 text-brand shrink-0" />
            Предпросмотр
            {ids.length > 0 && index >= 0 ? (
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {index + 1} / {ids.length}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 text-xs sm:text-sm">
            {typeLabel ? (
              <span className="rounded-full bg-muted px-2 py-0.5">{typeLabel}</span>
            ) : null}
            {statusLabel ? (
              <span className="rounded-full bg-muted px-2 py-0.5">{statusLabel}</span>
            ) : null}
            <span className="text-muted-foreground">Как увидит ученик</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-border bg-muted/30 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={index <= 0 || loading}
            onClick={goPrev}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Предыдущий
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={index < 0 || index >= ids.length - 1 || loading}
            onClick={goNext}
          >
            Следующий
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : detail ? (
            <>
              <div className="learner-content space-y-4">
                {bank === 'assessment' ? (
                  <QuestionCard question={detail} index={Math.max(0, index)} readOnly />
                ) : (
                  <div className="space-y-3">
                    {(detail.vocabulary || []).length ? (
                      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                        <p className="learner-label text-muted-foreground mb-1.5">Новые слова</p>
                        <p className="learner-vocab">
                          {(detail.vocabulary || [])
                            .map((v) =>
                              [v.word, v.pinyin ? `(${v.pinyin})` : null, v.translation]
                                .filter(Boolean)
                                .join(' '),
                            )
                            .join(' · ')}
                        </p>
                      </div>
                    ) : null}
                    <ExamItemRenderer
                      question={detail}
                      selectedIds={trySelect}
                      onSelect={(oid) => setTrySelect([oid])}
                    />
                  </div>
                )}
              </div>

              <div className="pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCorrect((v) => !v)}
                >
                  {showCorrect ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                      Скрыть правильный ответ
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      Показать правильный ответ
                    </>
                  )}
                </Button>
              </div>

              {showCorrect ? <CorrectAnswerPanel bank={bank} detail={detail} /> : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Вопрос не выбран</p>
          )}
        </div>

        <DialogFooter
          className={cn(
            'px-4 sm:px-6 py-3 border-t border-border bg-background shrink-0',
            'flex-col sm:flex-row sm:flex-wrap sm:justify-between gap-2',
          )}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!detail || busyAction}
              onClick={() => {
                onOpenChange(false);
                if (bank === 'assessment') onEdit?.(detail || { id: currentId }, 'edit');
                else onEdit?.(detail?.id || currentId);
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Редактировать
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!detail || busyAction}
              onClick={() => void handleCopy()}
            >
              {busyAction === 'copy' ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1" />
              )}
              Копировать
            </Button>
            {canDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-rose-600"
                disabled={!detail || busyAction}
                onClick={() => {
                  onRequestDelete?.(detail, currentId);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Удалить
              </Button>
            ) : null}
          </div>

          {showUseActions ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onOpenExamCreate?.(detail.id);
                }}
              >
                Использовать в тесте
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`${createPageUrl('HomeworkEditor')}?questionId=${encodeURIComponent(detail.id)}`);
                }}
              >
                Использовать в ДЗ
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onOpenExamCreate?.(detail.id);
                }}
              >
                Использовать в экзамене
              </Button>
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
