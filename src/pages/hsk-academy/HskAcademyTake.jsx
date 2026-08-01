import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';

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
      // ignore corrupt draft
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

  useEffect(() => {
    if (!sessionId) return undefined;
    const onStorage = (event) => {
      if (event.key !== draftKey(sessionId) || !event.newValue) return;
      try {
        setAnswers(JSON.parse(event.newValue));
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [sessionId]);

  const questions = useMemo(() => flattenQuestions(runtime?.sections), [runtime]);
  const current = questions[index];
  const currentId = current?.snapshotId || current?.snapshot_id;
  const options = current?.answers || [];
  const attachments = current?.attachments || [];
  const progress = questions.length ? Math.round(((index + 1) / questions.length) * 100) : 0;
  const shellActive =
    runtime?.session?.mode === 'mock_exam' || runtime?.session?.mode === 'random_exam'
      ? 'mock'
      : 'practice';

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
      setError('Нет сети. Завершение экзамена недоступно офлайн — ответы сохранены локально.');
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

  const exit = () => {
    if (!window.confirm('Выйти из экзамена? Ответы уже сохранены на сервере и в черновике браузера.')) {
      return;
    }
    navigate(createPageUrl('HskAcademy'));
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return;
      if (event.key === 'ArrowRight') {
        setIndex((v) => Math.min(questions.length - 1, v + 1));
      } else if (event.key === 'ArrowLeft') {
        setIndex((v) => Math.max(0, v - 1));
      } else if (event.key === 'm' || event.key === 'M' || event.key === 'ь' || event.key === 'Ь') {
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
          ? 'Офлайн · локальный черновик'
          : saveStatus === 'error'
            ? 'Ошибка сохранения'
            : '';

  return (
    <HskAcademyShell active={shellActive} fullBleed>
      {!online ? (
        <div className="hsk-offline-banner" role="status">
          Нет интернета. Ответы сохраняются локально и синхронизируются при восстановлении сети.
        </div>
      ) : null}

      <div className="hsk-take-chrome">
        <div className="hsk-take-top">
          <div>
            <strong>{runtime?.session?.title || 'HSK Academy'}</strong>
            <div className="hsk-muted hsk-take-meta">
              {[runtime?.version_title, runtime?.level_title, current?.sectionTitle]
                .filter(Boolean)
                .join(' · ')}
              {' · '}
              задание {questions.length ? index + 1 : 0}/{questions.length}
            </div>
          </div>
          <div className="hsk-take-top-right">
            <span className="hsk-timer" aria-live="polite">
              {mm}:{ss}
            </span>
            <span className="hsk-muted hsk-save-status">{saveLabel}</span>
            <button type="button" className="hsk-btn hsk-btn--ghost hsk-btn--sm" onClick={exit}>
              Выйти
            </button>
          </div>
        </div>
        <div className="hsk-progress" aria-hidden>
          <div className="hsk-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error ? <p className="hsk-error" style={{ padding: '0 1rem' }}>{error}</p> : null}

      <div className="hsk-take">
        <aside className="hsk-take-nav">
          <p className="hsk-muted" style={{ marginTop: 0 }}>
            Навигация · {answeredCount}/{questions.length}
          </p>
          <div className="hsk-take-nav-grid">
            {questions.map((q, i) => {
              const id = q.snapshotId || q.snapshot_id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`${i === index ? 'is-current' : ''} ${answers[id]?.length ? 'is-answered' : ''} ${marked.has(id) ? 'is-marked' : ''}`}
                  onClick={() => setIndex(i)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="hsk-take-stage">
          {!current ? (
            <p className="hsk-muted">Загрузка заданий…</p>
          ) : (
            <>
              {current.passageText || current.passage_text ? (
                <div className="hsk-passage">{current.passageText || current.passage_text}</div>
              ) : null}
              {attachments.map((att) => {
                if (att.kind === 'audio' && att.url) {
                  return (
                    <audio key={att.id || att.url} className="hsk-audio" controls preload="metadata" src={att.url}>
                      Аудио недоступно
                    </audio>
                  );
                }
                if ((att.kind === 'image' || att.kind === 'img') && att.url) {
                  return <img key={att.id || att.url} className="hsk-media-img" src={att.url} alt="" />;
                }
                return null;
              })}
              <div className="hsk-stem">{current.stem}</div>
              <div className="hsk-options">
                {options.map((opt) => {
                  const id = opt.snapshotId || opt.snapshot_id || opt.id;
                  const selected = answers[currentId]?.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`hsk-option ${selected ? 'is-selected' : ''}`}
                      onClick={() => selectOption(id)}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>
              <div className="hsk-actions hsk-actions--sticky">
                <button
                  type="button"
                  className="hsk-btn hsk-btn--ghost"
                  disabled={index <= 0}
                  onClick={() => setIndex((v) => Math.max(0, v - 1))}
                >
                  Назад
                </button>
                <button type="button" className="hsk-btn hsk-btn--ghost" onClick={toggleMark}>
                  {marked.has(currentId) ? 'Снять метку' : 'Пометить'}
                </button>
                <button
                  type="button"
                  className="hsk-btn hsk-btn--ghost"
                  disabled={index >= questions.length - 1}
                  onClick={() => setIndex((v) => Math.min(questions.length - 1, v + 1))}
                >
                  Вперёд
                </button>
                <button
                  type="button"
                  className="hsk-btn"
                  disabled={submitting}
                  onClick={() => {
                    if (window.confirm('Завершить экзамен и перейти к результатам?')) void submit();
                  }}
                >
                  {submitting ? 'Завершение…' : 'Завершить'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </HskAcademyShell>
  );
}
