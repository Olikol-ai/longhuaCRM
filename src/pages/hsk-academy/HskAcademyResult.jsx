import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';

export default function HskAcademyResult() {
  const [params] = useSearchParams();
  const sessionId = params.get('sessionId') || '';
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [wordMsg, setWordMsg] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    api.examAcademy.sessions
      .result(sessionId)
      .then(setPayload)
      .catch((err) => setError(userFacingError(err)));
  }, [sessionId]);

  const result = payload?.result;
  const items = payload?.items || [];
  const breakdowns = payload?.breakdowns || result?.breakdowns || [];
  const percent = Number(result?.percent) || 0;
  const score = result?.score;
  const maxScore = result?.max_score ?? result?.maxScore;
  const duration = result?.duration;

  const words = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      for (const w of item.vocabulary || []) {
        if (!w.word) continue;
        map.set(`${w.word}|${w.pinyin || ''}`, w);
      }
    }
    return [...map.values()];
  }, [items]);

  const saveWord = async (w) => {
    try {
      await api.examAcademy.me.addWord({
        word: w.word,
        pinyin: w.pinyin,
        translation: w.translation,
        explanation: w.explanation,
      });
      setWordMsg(`«${w.word}» добавлено в словарь`);
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const addFavorite = async (item) => {
    if (!item.source_question_id) return;
    try {
      await api.examAcademy.me.addFavorite({
        content_kind: 'question',
        content_id: item.source_question_id,
      });
      setWordMsg('Задание добавлено в избранное');
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  return (
    <HskAcademyShell active="prep">
      <section className="hsk-hero">
        <p className="hsk-kicker">Result</p>
        <h1>Результат</h1>
        <p className="hsk-lead">Баллы, разбор и новые слова из этой попытки.</p>
      </section>
      {error ? <p className="hsk-error">{error}</p> : null}
      {wordMsg ? <p className="hsk-muted">{wordMsg}</p> : null}

      <div className="hsk-stats-row">
        <div className="hsk-stat">
          <span>Баллы</span>
          <strong>
            {score ?? '—'} / {maxScore ?? '—'}
          </strong>
        </div>
        <div className="hsk-stat">
          <span>Процент</span>
          <strong>{percent}%</strong>
        </div>
        <div className="hsk-stat">
          <span>Время</span>
          <strong>{duration != null ? `${Math.max(1, Math.round(duration / 60))} мин` : '—'}</strong>
        </div>
        <div className="hsk-stat">
          <span>Ошибки</span>
          <strong>{items.filter((i) => i.is_correct === false).length}</strong>
        </div>
      </div>

      {breakdowns.length > 0 ? (
        <div className="hsk-panel">
          <h2>По разделам</h2>
          <ul className="hsk-list">
            {breakdowns.map((b) => (
              <li key={b.id || b.sectionKey || b.section_key}>
                <span>{b.sectionKey || b.section_key}</span>
                <strong>
                  {b.score} / {b.maxScore || b.max_score}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {words.length > 0 ? (
        <div className="hsk-panel">
          <h2>Новые слова</h2>
          <ul className="hsk-list">
            {words.map((w) => (
              <li key={`${w.word}-${w.pinyin}`}>
                <div>
                  <strong>{w.word}</strong>
                  {w.pinyin ? <span className="hsk-muted"> · {w.pinyin}</span> : null}
                  {w.translation ? <div className="hsk-muted">{w.translation}</div> : null}
                </div>
                <button type="button" className="hsk-btn hsk-btn--ghost hsk-btn--sm" onClick={() => saveWord(w)}>
                  В словарь
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="hsk-panel">
          <h2>Разбор заданий</h2>
          <div className="hsk-review-list">
            {items.map((item, idx) => (
              <article key={item.snapshot_id} className="hsk-review-card">
                <header>
                  <span>№{idx + 1}</span>
                  <strong className={item.is_correct === false ? 'is-wrong' : item.is_correct ? 'is-ok' : ''}>
                    {item.is_correct === false ? 'Ошибка' : item.is_correct ? 'Верно' : '—'}
                  </strong>
                </header>
                <p className="hsk-stem">{item.stem}</p>
                <ul className="hsk-options-readonly">
                  {(item.answers || []).map((a) => (
                    <li
                      key={a.id}
                      className={`${a.selected ? 'is-selected' : ''} ${a.is_correct ? 'is-correct' : ''}`}
                    >
                      {a.text}
                    </li>
                  ))}
                </ul>
                {item.explanation ? <p className="hsk-muted">{item.explanation}</p> : null}
                <button type="button" className="hsk-btn hsk-btn--ghost hsk-btn--sm" onClick={() => addFavorite(item)}>
                  В избранное
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="hsk-actions">
        <Link className="hsk-btn" to={createPageUrl('HskAcademy')}>
          В Academy
        </Link>
        <Link className="hsk-btn hsk-btn--ghost" to={createPageUrl('HskAcademyPreparation')}>
          Моя подготовка
        </Link>
        <Link className="hsk-btn hsk-btn--ghost" to={createPageUrl('HskAcademyPractice')}>
          Ещё тренировка
        </Link>
      </div>
    </HskAcademyShell>
  );
}
