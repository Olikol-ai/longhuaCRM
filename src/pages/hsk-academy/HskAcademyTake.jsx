import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bookmark, ChevronLeft, ChevronRight, Grid3X3, SkipForward } from 'lucide-react';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import { useIsMdUp } from '@/lib/responsive';
import { parentHref } from '@/lib/hskAcademyNav';
import ExamFocusChrome from '@/components/hsk-academy/ExamFocusChrome';
import { ExamItemRenderer, collectMediaUrls } from '@/components/hsk-academy/items/itemRegistry';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] != null) return obj[key];
  }
  return undefined;
}

function flattenQuestions(sections) {
  const list = [];
  for (const section of sections || []) {
    for (const q of section.questions || []) {
      list.push({
        ...q,
        sectionKey: section.sectionKey || section.section_key,
        sectionTitle: section.title,
      });
    }
  }
  return list;
}

const draftKey = (sessionId) => `hsk-academy-draft:${sessionId}`;

function QuestionGrid({ questions, answers, marked, index, onPick, className }) {
  return (
    <div className={cn('grid grid-cols-5 gap-1.5', className)}>
      {questions.map((q, i) => {
        const id = q.snapshotId || q.snapshot_id;
        const answered = Boolean(answers[id]?.length);
        const isCurrent = i === index;
        return (
          <button
            key={id}
            type="button"
            aria-label={`Задание ${i + 1}${answered ? ', отвечено' : ''}${marked.has(id) ? ', помечено' : ''}`}
            aria-current={isCurrent ? 'true' : undefined}
            className={cn(
              'min-h-10 rounded-md border text-xs font-medium tabular-nums transition-colors',
              isCurrent && 'border-brand bg-brand text-primary-foreground',
              !isCurrent && answered && 'border-border bg-muted text-foreground',
              !isCurrent && !answered && 'border-border bg-background text-muted-foreground hover:bg-muted/60',
              marked.has(id) && !isCurrent && 'ring-2 ring-amber-500/70 ring-offset-1 ring-offset-background',
            )}
            onClick={() => onPick(i)}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

export default function HskAcademyTake() {
  const [params] = useSearchParams();
  const sessionId = params.get('sessionId') || '';
  const from = params.get('from') || '';
  const navigate = useNavigate();
  const isMd = useIsMdUp();
  const [navOpen, setNavOpen] = useState(false);
  const [runtime, setRuntime] = useState(null);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(`${draftKey(sessionId)}:marked`) || '[]'));
    } catch {
      return new Set();
    }
  });
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(null);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [submitting, setSubmitting] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [sectionTick, setSectionTick] = useState(0);
  const autoSubmitted = useRef(false);
  const pendingSave = useRef(null);
  const stageRef = useRef(null);

  const load = useCallback(async () => {
    const data = await api.examAcademy.sessions.runtime(sessionId);
    setRuntime(data);
    const flat = flattenQuestions(data.sections);
    const restored = {};
    for (const q of flat) {
      const saved = q.savedAnswer || q.saved_answer;
      const ids = saved?.selectedAnswerSnapshotIds || saved?.selected_answer_snapshot_ids || [];
      if (ids.length) restored[q.snapshotId || q.snapshot_id] = ids;
    }
    try {
      const local = JSON.parse(localStorage.getItem(draftKey(sessionId)) || '{}');
      Object.assign(restored, local);
    } catch {
      // ignore
    }
    setAnswers(restored);
    const savedIndex = Number(sessionStorage.getItem(`${draftKey(sessionId)}:index`) || 0);
    if (Number.isFinite(savedIndex) && savedIndex >= 0 && savedIndex < flat.length) {
      setIndex(savedIndex);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    load().catch((err) => setError(userFacingError(err)));
    return undefined;
  }, [sessionId, load]);

  useEffect(() => {
    if (!sessionId) return;
    sessionStorage.setItem(`${draftKey(sessionId)}:index`, String(index));
  }, [index, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    localStorage.setItem(draftKey(sessionId), JSON.stringify(answers));
  }, [answers, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    sessionStorage.setItem(`${draftKey(sessionId)}:marked`, JSON.stringify([...marked]));
  }, [marked, sessionId]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const questions = useMemo(() => flattenQuestions(runtime?.sections), [runtime]);
  const current = questions[index];
  const currentId = current?.snapshotId || current?.snapshot_id;
  const progress = questions.length ? Math.round(((index + 1) / questions.length) * 100) : 0;
  const nextPrefetch = useMemo(
    () => collectMediaUrls(questions[index + 1]),
    [questions, index],
  );

  useEffect(() => {
    stageRef.current?.scrollTo?.({ top: 0 });
  }, [index]);

  useEffect(() => {
    const expires = pick(runtime?.attempt, 'expiresAt', 'expires_at');
    if (!expires) return undefined;
    const tick = () => {
      const ms = new Date(expires).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
      setSectionTick((n) => n + 1);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [runtime]);

  const submit = useCallback(async () => {
    if (submitting || autoSubmitted.current) return;
    if (!navigator.onLine) {
      setError('Нет сети. Завершение недоступно офлайн — ответы сохранены локально.');
      return;
    }
    setSubmitting(true);
    try {
      await api.examAcademy.sessions.submit(sessionId);
      localStorage.removeItem(draftKey(sessionId));
      sessionStorage.removeItem(`${draftKey(sessionId)}:index`);
      sessionStorage.removeItem(`${draftKey(sessionId)}:marked`);
      navigate(
        `${createPageUrl('HskAcademyResult')}?sessionId=${sessionId}${
          from ? `&from=${encodeURIComponent(from)}` : ''
        }`,
      );
    } catch (err) {
      setError(userFacingError(err));
      setSubmitting(false);
      autoSubmitted.current = false;
    }
  }, [navigate, sessionId, submitting]);

  useEffect(() => {
    if (remaining !== 0) return;
    if (submitting || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void submit();
  }, [remaining, submitting, submit]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (submitting) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [submitting]);

  const flushPending = useCallback(async () => {
    if (!pendingSave.current || !navigator.onLine) return;
    const payload = pendingSave.current;
    pendingSave.current = null;
    setSaveStatus('saving');
    try {
      await api.examAcademy.sessions.saveAnswers(sessionId, payload);
      setSaveStatus('saved');
    } catch (err) {
      pendingSave.current = payload;
      setSaveStatus('error');
      setError(userFacingError(err));
    }
  }, [sessionId]);

  useEffect(() => {
    if (online) void flushPending();
  }, [online, flushPending]);

  const selectOption = async (optionId) => {
    if (!currentId) return;
    const next = { ...answers, [currentId]: [optionId] };
    setAnswers(next);
    const payload = [
      {
        question_snapshot_id: currentId,
        selected_answer_snapshot_ids: [optionId],
      },
    ];
    if (!navigator.onLine) {
      pendingSave.current = payload;
      setSaveStatus('offline');
      return;
    }
    setSaveStatus('saving');
    try {
      await api.examAcademy.sessions.saveAnswers(sessionId, payload);
      setSaveStatus('saved');
    } catch (err) {
      pendingSave.current = payload;
      setSaveStatus('error');
      setError(userFacingError(err));
    }
  };

  const toggleMark = () => {
    if (!currentId) return;
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(currentId)) next.delete(currentId);
      else next.add(currentId);
      return next;
    });
  };

  const go = (nextIndex) => {
    setIndex(Math.max(0, Math.min(questions.length - 1, nextIndex)));
  };

  const skip = () => go(index + 1);

  const exit = async () => {
    if (!window.confirm('Выйти из экзамена? Ответы сохранены на сервере и в черновике браузера.')) {
      return;
    }
    const answered = Object.values(answers).some((ids) => Array.isArray(ids) && ids.length > 0);
    if (!answered && sessionId) {
      try {
        await api.examAcademy.sessions.abandonIfEmpty(sessionId);
      } catch {
        // best-effort discard of empty attempt
      }
    }
    navigate(parentHref('HskAcademyTake', params) || createPageUrl('HskAcademy'));
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return;
      if (event.key === 'ArrowRight') skip();
      else if (event.key === 'ArrowLeft') go(index - 1);
      else if (event.key === 'm' || event.key === 'M' || event.key === 'ь' || event.key === 'Ь') {
        toggleMark();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length, currentId, index]);

  const mm = remaining == null ? '—' : String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = remaining == null ? '--' : String(remaining % 60).padStart(2, '0');

  const sectionTimings = runtime?.section_timings || runtime?.sectionTimings || [];
  const currentSectionKey = current?.sectionKey || current?.section_key;
  const softSectionRemaining = (() => {
    void sectionTick;
    if (!sectionTimings.length || !currentSectionKey) return null;
    const startedAt = pick(runtime?.attempt, 'startedAt', 'started_at');
    if (!startedAt) return null;
    const startMs = new Date(startedAt).getTime();
    let offset = 0;
    for (const row of sectionTimings) {
      const key = row.sectionKey || row.section_key;
      const dur = Number(row.durationSeconds ?? row.duration_seconds) || 0;
      if (key === currentSectionKey) {
        const deadline = startMs + (offset + dur) * 1000;
        return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      }
      offset += dur;
    }
    return null;
  })();
  const sectionMm =
    softSectionRemaining == null
      ? null
      : String(Math.floor(softSectionRemaining / 60)).padStart(2, '0');
  const sectionSs =
    softSectionRemaining == null
      ? null
      : String(softSectionRemaining % 60).padStart(2, '0');

  const answeredCount = questions.filter((q) => {
    const id = q.snapshotId || q.snapshot_id;
    return answers[id]?.length;
  }).length;

  const saveLabel =
    saveStatus === 'saving'
      ? 'Сохранение…'
      : saveStatus === 'saved'
        ? 'Сохранено'
        : saveStatus === 'offline'
          ? 'Офлайн'
          : saveStatus === 'error'
            ? 'Ошибка сохранения'
            : '';

  const pickQuestion = (i) => {
    go(i);
    setNavOpen(false);
  };

  const rail = (
    <aside className="hidden md:flex md:flex-col w-[9.5rem] lg:w-44 shrink-0 border-r border-border bg-card/40 min-h-0">
      <div className="px-2.5 py-2 border-b border-border shrink-0">
        <p className="text-[11px] text-muted-foreground">
          Отвечено {answeredCount}/{questions.length || 0}
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <QuestionGrid
          questions={questions}
          answers={answers}
          marked={marked}
          index={index}
          onPick={pickQuestion}
          className="lg:grid-cols-4"
        />
      </div>
    </aside>
  );

  const footer = (
    <div className="px-3 sm:px-4 py-2.5 sm:py-3">
      {/* Mobile: primary pager */}
      <div className="flex md:hidden items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0"
          disabled={index <= 0}
          onClick={() => go(index - 1)}
          aria-label="Назад"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 flex-1 min-w-0 gap-1.5"
          onClick={() => setNavOpen(true)}
        >
          <Grid3X3 className="h-4 w-4 shrink-0" />
          <span className="tabular-nums">
            {questions.length ? `${index + 1} / ${questions.length}` : '—'}
          </span>
        </Button>
        <Button
          type="button"
          size="icon"
          className="h-12 w-12 shrink-0"
          disabled={index >= questions.length - 1}
          onClick={() => go(index + 1)}
          aria-label="Вперёд"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex md:hidden gap-2 mt-2">
        <Button
          type="button"
          variant={marked.has(currentId) ? 'secondary' : 'outline'}
          className="min-h-11 flex-1 gap-1.5"
          onClick={toggleMark}
        >
          <Bookmark className="h-4 w-4" />
          {marked.has(currentId) ? 'Метка' : 'Пометить'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 gap-1.5"
          disabled={index >= questions.length - 1}
          onClick={skip}
        >
          <SkipForward className="h-4 w-4" />
          Пропустить
        </Button>
        <Button
          type="button"
          className="min-h-11 flex-1"
          disabled={submitting}
          onClick={() => {
            if (window.confirm('Завершить экзамен и перейти к результатам?')) void submit();
          }}
        >
          {submitting ? '…' : 'Завершить'}
        </Button>
      </div>

      {/* Tablet / desktop actions */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-1"
          disabled={index <= 0}
          onClick={() => go(index - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-1"
          disabled={index >= questions.length - 1}
          onClick={() => go(index + 1)}
        >
          Вперёд
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={marked.has(currentId) ? 'secondary' : 'outline'}
          className="min-h-11 gap-1.5"
          onClick={toggleMark}
        >
          <Bookmark className="h-4 w-4" />
          {marked.has(currentId) ? 'Снять метку' : 'Пометить'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 gap-1.5"
          disabled={index >= questions.length - 1}
          onClick={skip}
        >
          <SkipForward className="h-4 w-4" />
          Пропустить
        </Button>
        <div className="flex-1" />
        <p className="text-xs text-muted-foreground tabular-nums hidden lg:block mr-2">
          {answeredCount}/{questions.length} ответов
        </p>
        <Button
          type="button"
          className="min-h-11 min-w-[8.5rem]"
          disabled={submitting}
          onClick={() => {
            if (window.confirm('Завершить экзамен и перейти к результатам?')) void submit();
          }}
        >
          {submitting ? 'Завершение…' : 'Завершить'}
        </Button>
      </div>
    </div>
  );

  return (
    <ExamFocusChrome
      title={runtime?.session?.title || 'HSK Academy'}
      sectionLabel={current?.sectionTitle}
      counterLabel={
        questions.length ? `№ ${index + 1} из ${questions.length}` : null
      }
      timerLabel={`${mm}:${ss}`}
      sectionTimerLabel={
        sectionMm != null && sectionSs != null ? `${sectionMm}:${sectionSs}` : null
      }
      saveLabel={saveLabel}
      progress={progress}
      online={online}
      onExit={exit}
      footer={footer}
    >
      {error ? (
        <div className="shrink-0 px-3 sm:px-4 py-2 text-sm text-destructive border-b border-border bg-destructive/5">
          {error}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {isMd ? rail : null}

        <section
          ref={stageRef}
          className="flex-1 min-w-0 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto w-full max-w-3xl xl:max-w-4xl px-3 sm:px-5 py-4 sm:py-5 pb-6">
            {!current ? (
              <p className="text-sm text-muted-foreground">Загрузка заданий…</p>
            ) : (
              <ExamItemRenderer
                question={current}
                selectedIds={answers[currentId] || []}
                onSelect={selectOption}
                prefetchUrls={nextPrefetch}
              />
            )}
          </div>
        </section>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="bottom" className="max-h-[75dvh] rounded-t-xl px-4 pb-6">
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="text-base">
              Задания · {answeredCount}/{questions.length}
            </SheetTitle>
          </SheetHeader>
          <QuestionGrid
            questions={questions}
            answers={answers}
            marked={marked}
            index={index}
            onPick={pickQuestion}
            className="grid-cols-6 sm:grid-cols-8"
          />
          <p className="mt-3 text-[11px] text-muted-foreground">
            Текущее — цвет бренда · отвеченное — серое · метка — жёлтое кольцо
          </p>
        </SheetContent>
      </Sheet>
    </ExamFocusChrome>
  );
}
