import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import QuestionCard from '@/components/assessment/QuestionCard';
import TaskMaterialHeader from '@/components/assessment/TaskMaterialHeader';
import { userFacingError } from '@/lib/userFacingError';

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
  const focusAssignmentId = params.get('assignmentId');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(null);
  const [localAnswers, setLocalAnswers] = useState({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.homework.myAssignments();
      setCards(Array.isArray(data) ? data : []);
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
    void load();
  }, []);

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
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (attempt) {
    const submitted = attempt.status === 'submitted';
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" data-testid="homework-viewer-attempt">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{attempt.title || 'Домашнее задание'}</h1>
            {attempt.owner_name && (
              <p className="text-sm text-slate-500 mt-1">
                {attempt.owner_type === 'tutor' ? 'Репетитор' : 'Преподаватель'}: {attempt.owner_name}
              </p>
            )}
            {attempt.instructions && (
              <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4">
                {attempt.instructions}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setAttempt(null)}>
            К списку
          </Button>
        </div>

        {(attempt.questions || []).map((q, index) => {
          const prev = index > 0 ? attempt.questions[index - 1] : null;
          const showPrelude =
            !prev ||
            prev.passage_text !== q.passage_text ||
            prev.task_instructions !== q.task_instructions ||
            JSON.stringify(prev.vocabulary || []) !== JSON.stringify(q.vocabulary || []);
          return (
          <div key={q.id}>
            {showPrelude ? (
              <TaskMaterialHeader
                instructions={q.task_instructions}
                vocabulary={q.vocabulary}
                passageText={q.passage_text}
              />
            ) : null}
            <QuestionCard
              question={q}
              index={index}
              localAnswer={localAnswers[q.id]}
              readOnly={submitted}
              onSingleChoice={(_qid, id) =>
                !submitted && setAnswer(q.id, { selected_answer_snapshot_ids: [id] })
              }
              onToggleMultiple={(_qid, id) => {
                if (submitted) return;
                const cur = localAnswers[q.id]?.selected_answer_snapshot_ids || [];
                const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
                setAnswer(q.id, { selected_answer_snapshot_ids: next });
              }}
              onTextChange={(_qid, text) => !submitted && setAnswer(q.id, { text })}
              onSpeakingUpload={
                submitted
                  ? undefined
                  : (qid, file, durationMs) => handleSpeakingUpload(qid, file, durationMs)
              }
            />
          </div>
          );
        })}

        {submitted && attempt.result && (
          <div className="rounded-2xl border p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
            <p className="font-semibold">
              {attempt.result.status === 'pending_review'
                ? 'Ожидает проверки преподавателем'
                : 'Результат'}
            </p>
            {attempt.result.status !== 'pending_review' && (
              <p className="text-sm mt-1">
                {attempt.result.score} / {attempt.result.max_score} ({attempt.result.percent}%)
              </p>
            )}
            {attempt.result.status === 'pending_review' && (
              <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">
                Автоматическая часть оценена. Текстовые и Speaking-ответы проверяет преподаватель.
              </p>
            )}
          </div>
        )}

        {!submitted && (
          <div className="flex justify-end">
            <Button disabled={busy} onClick={handleSubmit} data-testid="homework-submit">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Отправить'}
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
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" data-testid="homework-viewer">
      <div>
        <h1 className="text-2xl font-bold">Домашние задания</h1>
        <p className="text-sm text-slate-500 mt-1">
          Новые задания и история: когда назначено, кто выдал, статус выполнения
        </p>
      </div>

      {sections.map(([key, label]) => (
        <div key={key} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{label}</h2>
          {(grouped[key] || []).length === 0 ? (
            <p className="text-xs text-slate-400">Нет</p>
          ) : (
            groupByOwner(grouped[key] || []).map((ownerGroup) => (
              <div key={`${key}:${ownerGroup.ownerType}:${ownerGroup.ownerName}`} className="space-y-2">
                <p className="text-xs font-medium text-slate-500">
                  {ownerGroup.ownerType === 'tutor' ? 'Репетитор' : 'Преподаватель'}: {ownerGroup.ownerName}
                </p>
                {ownerGroup.items.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handleOpen(card)}
                    className="w-full text-left bg-white dark:bg-slate-900 border rounded-xl p-4 hover:border-brand/40"
                  >
                    <div className="font-medium">{card.title}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {STATUS_LABEL[card.status] || card.status}
                      {card.assigned_at
                        ? ` · назначено ${new Date(card.assigned_at).toLocaleString('ru-RU')}`
                        : ''}
                      {card.due_at ? ` · до ${new Date(card.due_at).toLocaleString('ru-RU')}` : ''}
                      {card.result?.percent != null ? ` · ${card.result.percent}%` : ''}
                    </div>
                    {card.activity_kind ? (
                      <div className="text-xs text-slate-400 mt-1">Тип: {card.activity_kind}</div>
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
