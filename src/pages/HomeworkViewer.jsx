import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { Button, Card, CardContent, Caption, Spinner } from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import LearnerQuestionBlocks from '@/components/assessment/LearnerQuestionBlocks';
import { userFacingError } from '@/lib/userFacingError';
import { buildHomeworkItemReviews } from '@/lib/homework-item-review';
import { useAuth } from '@/lib/AuthContext';
import { OfflineSnapshotBanner } from '@/components/pwa/OfflineSnapshotBanner';
import { OFFLINE_RESOURCES, readWithOfflineFallback } from '@/lib/offline';

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

export default function HomeworkViewer() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const focusAssignmentId = params.get('assignmentId');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(null);
  const [localAnswers, setLocalAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [offlineMeta, setOfflineMeta] = useState({ fromCache: false, updatedAt: null, missing: false });

  const load = async () => {
    setLoading(true);
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const result = await readWithOfflineFallback({
        userId: user.id,
        role: user.role || 'student',
        resource: OFFLINE_RESOURCES.HOMEWORK,
        resourceKey: 'my_assignments',
        fetcher: async () => {
          const data = await api.homework.myAssignments();
          return { cards: Array.isArray(data) ? data : [] };
        },
      });
      setOfflineMeta({
        fromCache: result.fromCache,
        updatedAt: result.updatedAt,
        missing: result.missing,
      });
      setCards(result.data?.cards || []);
    } catch (err) {
      toast({
        title: 'Не удалось загрузить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) void load();
  }, [user?.id]);

  useEffect(() => {
    if (!focusAssignmentId || !cards.length) return;
    const card = cards.find((c) => c.id === focusAssignmentId);
    if (card && (card.status === 'assigned' || card.status === 'started' || card.status === 'in_progress' || card.status === 'needs_revision')) {
      void handleOpen(card);
    }
  }, [focusAssignmentId, cards]);

  const grouped = useMemo(() => {
    const buckets = {
      assigned: [],
      started: [],
      submitted: [],
      checked: [],
      expired: [],
      cancelled: [],
      needs_revision: [],
    };
    const aliases = {
      in_progress: 'started',
      reviewed: 'checked',
      overdue: 'expired',
    };
    for (const c of cards) {
      const mapped = aliases[c.status] || c.status;
      const key = buckets[mapped] ? mapped : 'assigned';
      buckets[key].push(c);
    }
    return buckets;
  }, [cards]);

  const groupByOwner = (items) => {
    const map = new Map();
    for (const item of items) {
      const key = `${item.owner_type || 'owner'}:${item.owner_name || 'Без владельца'}`;
      if (!map.has(key)) {
        map.set(key, {
          ownerType: item.owner_type || null,
          ownerName: item.owner_name || 'Без владельца',
          items: [],
        });
      }
      map.get(key).items.push(item);
    }
    return [...map.values()];
  };

  const handleOpen = async (card) => {
    setBusy(true);
    try {
      let state;
      if (card.attempt?.status === 'started') {
        state = await api.homework.getAttempt(card.attempt.id);
      } else if (card.attempt?.status === 'submitted') {
        state = await api.homework.getAttempt(card.attempt.id);
      } else {
        state = await api.homework.start(card.id);
      }
      setAttempt(state);
      const map = {};
      for (const a of state.answers || []) {
        map[a.question_snapshot_id] = {
          selected_answer_snapshot_ids: a.selected_answer_snapshot_ids || [],
          text: a.text || '',
          has_audio: Boolean(a.has_audio),
          audio_url: a.audio_url || null,
          audio_mime: a.audio_mime || null,
          audio_duration_ms: a.audio_duration_ms ?? null,
        };
      }
      setLocalAnswers(map);
    } catch (err) {
      toast({
        title: 'Не удалось открыть',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const setAnswer = (questionId, patch) => {
    setLocalAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || { selected_answer_snapshot_ids: [], text: '' }),
        ...patch,
      },
    }));
  };

  const handleSpeakingUpload = async (questionId, file, durationMs) => {
    if (!attempt?.id) return;
    const payload = await api.homework.uploadSpeakingAudio(
      attempt.id,
      questionId,
      file,
      durationMs,
    );
    setAnswer(questionId, {
      has_audio: true,
      audio_url: payload.audio_url || null,
      audio_mime: payload.audio_mime || null,
      audio_duration_ms: payload.audio_duration_ms ?? durationMs ?? null,
    });
  };

  const buildAnswersPayload = () =>
    Object.entries(localAnswers).map(([question_snapshot_id, a]) => ({
      question_snapshot_id,
      selected_answer_snapshot_ids: a.selected_answer_snapshot_ids || [],
      text: a.text || undefined,
    }));

  const handleSubmit = async () => {
    if (!attempt?.id) return;
    setBusy(true);
    try {
      const state = await api.homework.submit(attempt.id, buildAnswersPayload());
      setAttempt(state);
      toast({ title: 'Домашнее задание отправлено' });
      await load();
    } catch (err) {
      toast({
        title: 'Не удалось отправить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (attempt) {
    const submitted = attempt.status === 'submitted';
    const reviewed =
      attempt.result?.status === 'checked' || attempt.result?.status === 'reviewed';
    const teacherComment =
      attempt.student_feedback ||
      attempt.owner_comment ||
      attempt.result?.student_feedback ||
      attempt.result?.owner_comment ||
      '';
    const itemReviews = reviewed
      ? buildHomeworkItemReviews(attempt.questions || [], attempt.answers || [])
      : null;
    return (
      <div
        className="learner-content p-4 sm:p-6 max-w-3xl mx-auto space-y-6 min-w-0 overflow-x-hidden"
        data-testid="homework-viewer-attempt"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{attempt.title || 'Домашнее задание'}</h1>
            {attempt.owner_name && (
              <p className="learner-meta text-muted-foreground mt-1">
                {attempt.owner_type === 'tutor' ? 'Репетитор' : 'Преподаватель'}: {attempt.owner_name}
              </p>
            )}
            {attempt.instructions && (
              <div className="learner-body mt-3 text-foreground rounded-xl bg-muted p-4">
                {attempt.instructions}
              </div>
            )}
          </div>
          <Button intent="outline" size="sm" className="min-h-11 shrink-0" onClick={() => setAttempt(null)}>
            К списку
          </Button>
        </div>

        {submitted && attempt.result && (
          <Card data-testid="homework-student-result">
            <CardContent className="space-y-3 pt-6">
              <p className="font-semibold">
                {attempt.result.status === 'pending_review'
                  ? 'Ожидает проверки преподавателем'
                  : 'Результат'}
              </p>
              {reviewed && (
                <p className="text-lg" data-testid="homework-student-percent">
                  {attempt.result.percent}%
                </p>
              )}
              {reviewed && (attempt.result.score != null || attempt.result.max_score != null) && (
                <Caption>
                  Баллы: {attempt.result.score} / {attempt.result.max_score}
                </Caption>
              )}
              {reviewed && teacherComment ? (
                <div data-testid="homework-student-feedback">
                  <p className="text-sm font-medium">Комментарий преподавателя</p>
                  <p className="text-sm whitespace-pre-wrap break-words mt-1">{teacherComment}</p>
                </div>
              ) : null}
              {attempt.result.status === 'pending_review' && (
                <Caption>
                  Автоматическая часть оценена. Текстовые и Speaking-ответы проверяет преподаватель.
                </Caption>
              )}
            </CardContent>
          </Card>
        )}

        <LearnerQuestionBlocks
          questions={attempt.questions || []}
          answers={localAnswers}
          itemReviews={itemReviews}
          mode="list"
          readOnly={submitted}
          onSingleChoice={(qid, id) =>
            !submitted && setAnswer(qid, { selected_answer_snapshot_ids: [id] })
          }
          onToggleMultiple={(qid, id) => {
            if (submitted) return;
            const cur = localAnswers[qid]?.selected_answer_snapshot_ids || [];
            const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
            setAnswer(qid, { selected_answer_snapshot_ids: next });
          }}
          onTextChange={(qid, text) => !submitted && setAnswer(qid, { text })}
          onSpeakingUpload={
            submitted
              ? undefined
              : (qid, file, durationMs) => handleSpeakingUpload(qid, file, durationMs)
          }
        />

        {!submitted && (
          <div className="flex justify-end">
            <Button
              disabled={busy}
              onClick={handleSubmit}
              data-testid="homework-submit"
              className="min-h-11"
              loading={busy}
            >
              Отправить
            </Button>
          </div>
        )}
      </div>
    );
  }

  const sections = [
    ['assigned', 'Новые'],
    ['started', 'В работе'],
    ['submitted', 'На проверке'],
    ['checked', 'Проверенные'],
    ['needs_revision', 'На доработке'],
    ['expired', 'Просроченные'],
    ['cancelled', 'Отменённые'],
  ];

  return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6 min-w-0 overflow-x-hidden" data-testid="homework-viewer">
      <OfflineSnapshotBanner
        fromCache={offlineMeta.fromCache}
        updatedAt={offlineMeta.updatedAt}
        missing={offlineMeta.missing}
        emptyLabel="Домашние задания пока недоступны без подключения"
      />
      <div>
        <h1 className="text-2xl font-bold">Домашние задания</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Новые задания и история: когда назначено, кто выдал, статус выполнения
        </p>
      </div>

      {sections.map(([key, label]) => (
        <div key={key} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</h2>
          {(grouped[key] || []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Нет</p>
          ) : (
            groupByOwner(grouped[key] || []).map((ownerGroup) => (
              <div key={`${key}:${ownerGroup.ownerType}:${ownerGroup.ownerName}`} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {ownerGroup.ownerType === 'tutor' ? 'Репетитор' : 'Преподаватель'}: {ownerGroup.ownerName}
                </p>
                {ownerGroup.items.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handleOpen(card)}
                    className="w-full text-left bg-card border rounded-xl p-4 min-h-11 hover:border-brand/40 min-w-0"
                  >
                    <div className="font-medium">{card.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {STATUS_LABEL[card.status] || card.status}
                      {card.assigned_at
                        ? ` · назначено ${new Date(card.assigned_at).toLocaleString('ru-RU')}`
                        : ''}
                      {card.due_at ? ` · до ${new Date(card.due_at).toLocaleString('ru-RU')}` : ''}
                      {card.result?.percent != null ? ` · ${card.result.percent}%` : ''}
                    </div>
                    {card.activity_kind ? (
                      <div className="text-xs text-muted-foreground mt-1">Тип: {card.activity_kind}</div>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
