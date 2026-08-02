import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import { useIsLgUp, useIsMdUp } from '@/lib/responsive';
import ExamFocusChrome from '@/components/hsk-academy/ExamFocusChrome';
import { ExamItemRenderer, collectMediaUrls } from '@/components/hsk-academy/items/itemRegistry';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export default function HskAcademyTake() {
  const [params] = useSearchParams();
  const sessionId = params.get('sessionId') || '';
  const navigate = useNavigate();
  const isLg = useIsLgUp();
  const isMd = useIsMdUp();
  const [navOpen, setNavOpen] = useState(() => false);
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
  const autoSubmitted = useRef(false);
  const pendingSave = useRef(null);

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
    const expires = pick(runtime?.attempt, 'expiresAt', 'expires_at');
    if (!expires) return undefined;
    const tick = () => {
      const ms = new Date(expires).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
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
      navigate(`${createPageUrl('HskAcademyResult')}?sessionId=${sessionId}`);
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

  const skip = () => {
    setIndex((v) => Math.min(questions.length - 1, v + 1));
  };

  const exit = () => {
    if (!window.confirm('Выйти из экзамена? Ответы сохранены на сервере и в черновике браузера.')) {
      return;
    }
    navigate(createPageUrl('HskAcademy'));
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return;
      if (event.key === 'ArrowRight') skip();
      else if (event.key === 'ArrowLeft') setIndex((v) => Math.max(0, v - 1));
      else if (event.key === 'm' || event.key === 'M' || event.key === 'ь' || event.key === 'Ь') {
        toggleMark();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length, currentId]);

  const mm = remaining == null ? '—' : String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = remaining == null ? '--' : String(remaining % 60).padStart(2, '0');
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
          ? 'Офлайн · черновик'
          : saveStatus === 'error'
            ? 'Ошибка сохранения'
            : '';

  const meta = [
    runtime?.version_title,
    runtime?.level_title,
    current?.sectionTitle,
    questions.length ? `№ ${index + 1}/${questions.length}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const railAlways = isLg;
  /** Desktop: always show rail. Tablet/mobile: toggle via button. */
  const showSideNav = railAlways || navOpen;

  const navPanel = (
    <aside
      className={cn(
        'rounded-lg border border-border bg-card p-3 space-y-3',
        railAlways ? 'w-56 shrink-0' : 'w-full',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Навигация · {answeredCount}/{questions.length}
        </p>
        {!railAlways ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setNavOpen(false)}>
            Скрыть
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-4 gap-2">
        {questions.map((q, i) => {
          const id = q.snapshotId || q.snapshot_id;
          return (
            <button
              key={id}
              type="button"
              className={cn(
                'min-h-11 rounded-md border text-sm font-medium transition-colors',
                i === index && 'border-brand bg-brand/15',
                answers[id]?.length && i !== index && 'border-border bg-muted/50',
                marked.has(id) && 'ring-2 ring-amber-500/60',
                !answers[id]?.length && i !== index && 'border-border bg-background',
              )}
              onClick={() => {
                setIndex(i);
                if (!railAlways) setNavOpen(false);
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="text-[10px]">текущее</Badge>
        <Badge variant="secondary" className="text-[10px]">ответ</Badge>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> метка
        </span>
      </div>
    </aside>
  );

  return (
    <ExamFocusChrome
      title={runtime?.session?.title || 'HSK Academy'}
      meta={meta}
      timerLabel={`${mm}:${ss}`}
      saveLabel={saveLabel}
      progress={progress}
      online={online}
      onExit={exit}
    >
      {error ? <p className="text-sm text-destructive mb-3">{error}</p> : null}

      {!railAlways ? (
        <div className="mb-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? 'Скрыть задания' : 'Список заданий'}
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          'flex gap-4',
          railAlways ? 'flex-row' : 'flex-col',
          isMd && !railAlways && showSideNav ? 'md:flex-row' : null,
        )}
      >
        {showSideNav ? navPanel : null}

        <section className="flex-1 min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6 space-y-4">
          {!current ? (
            <p className="text-sm text-muted-foreground">Загрузка заданий…</p>
          ) : (
            <>
              <ExamItemRenderer
                question={current}
                selectedIds={answers[currentId] || []}
                onSelect={selectOption}
                prefetchUrls={nextPrefetch}
              />
              <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 border-t border-border bg-card/95 backdrop-blur flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={index <= 0}
                  onClick={() => setIndex((v) => Math.max(0, v - 1))}
                >
                  Назад
                </Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={toggleMark}>
                  {marked.has(currentId) ? 'Снять метку' : 'Пометить'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={index >= questions.length - 1}
                  onClick={skip}
                >
                  Пропустить
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={index >= questions.length - 1}
                  onClick={() => setIndex((v) => Math.min(questions.length - 1, v + 1))}
                >
                  Вперёд
                </Button>
                <Button
                  type="button"
                  className="min-h-11 ml-auto"
                  disabled={submitting}
                  onClick={() => {
                    if (window.confirm('Завершить экзамен и перейти к результатам?')) void submit();
                  }}
                >
                  {submitting ? 'Завершение…' : 'Завершить'}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </ExamFocusChrome>
  );
}
