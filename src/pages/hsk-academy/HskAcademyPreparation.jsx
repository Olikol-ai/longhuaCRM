import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';

const MODE_LABEL = {
  practice: 'Тренировка',
  mock_exam: 'Пробный',
  random_exam: 'Случайный',
  error_review: 'Ошибки',
  favorites: 'Избранное',
};

const STATUS_LABEL = {
  draft: 'Черновик',
  ready: 'Готово',
  in_progress: 'В процессе',
  completed: 'Завершено',
  cancelled: 'Отменено',
};

export default function HskAcademyPreparation() {
  const [data, setData] = useState(null);
  const [words, setWords] = useState([]);
  const [review, setReview] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('history');

  const reload = async () => {
    const [prep, dict, rev, fav] = await Promise.all([
      api.examAcademy.me.preparation(),
      api.examAcademy.me.dictionary(),
      api.examAcademy.me.review(),
      api.examAcademy.me.favorites(),
    ]);
    setData(prep);
    setWords(Array.isArray(dict) ? dict : []);
    setReview(Array.isArray(rev) ? rev : []);
    setFavorites(Array.isArray(fav) ? fav : []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (err) {
        if (!cancelled) setError(userFacingError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const history = data?.history || [];
  const series = data?.stats_series || [];
  const achievements = data?.achievements || [];

  const removeWord = async (id) => {
    try {
      await api.examAcademy.me.deleteWord(id);
      setWords((rows) => rows.filter((w) => w.id !== id));
      setMsg('Слово удалено');
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const markLearned = async (id) => {
    try {
      await api.examAcademy.me.updateWord(id, { status: 'learned' });
      setWords((rows) => rows.map((w) => (w.id === id ? { ...w, status: 'learned' } : w)));
      setMsg('Отмечено как выученное');
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const removeFavorite = async (id) => {
    try {
      await api.examAcademy.me.removeFavorite(id);
      setFavorites((rows) => rows.filter((f) => f.id !== id));
      setMsg('Убрано из избранного');
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  return (
    <HskAcademyShell active="prep">
      <section className="hsk-hero">
        <p className="hsk-kicker">Learner Cabinet</p>
        <h1>Моя подготовка</h1>
        <p className="hsk-lead">
          Центр вашей подготовки: история, динамика, словарь, избранное, ошибки и достижения.
        </p>
      </section>

      {error ? <p className="hsk-error">{error}</p> : null}
      {msg ? <p className="hsk-muted">{msg}</p> : null}

      <div className="hsk-tab-row" role="tablist">
        {[
          ['history', 'История'],
          ['dynamics', 'Динамика'],
          ['dictionary', 'Словарь'],
          ['favorites', 'Избранное'],
          ['review', 'Ошибки'],
          ['achievements', 'Достижения'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`hsk-btn hsk-btn--sm ${tab === id ? '' : 'hsk-btn--ghost'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <div className="hsk-panel">
          <h2>История попыток</h2>
          {history.length === 0 ? (
            <p className="hsk-muted">Пока нет сессий. Начните с тренировки.</p>
          ) : (
            <ul className="hsk-list">
              {history.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{row.title || MODE_LABEL[row.mode] || row.mode}</strong>
                    <div className="hsk-muted">
                      {MODE_LABEL[row.mode] || row.mode}
                      {row.level?.title ? ` · ${row.level.title}` : ''}
                    </div>
                  </div>
                  <span>
                    {STATUS_LABEL[row.status] || row.status}
                    {row.status === 'completed' ? (
                      <>
                        {' · '}
                        <Link to={`${createPageUrl('HskAcademyResult')}?sessionId=${row.id}`}>
                          результат
                        </Link>
                      </>
                    ) : null}
                    {row.status === 'in_progress' ? (
                      <>
                        {' · '}
                        <Link to={`${createPageUrl('HskAcademyTake')}?sessionId=${row.id}`}>
                          продолжить
                        </Link>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'dynamics' && (
        <div className="hsk-panel">
          <h2>Динамика</h2>
          {series.length === 0 ? (
            <p className="hsk-muted">Недостаточно данных для графика.</p>
          ) : (
            <div className="hsk-bars">
              {series.map((row) => (
                <div key={row.id} className="hsk-bar-row">
                  <span className="hsk-muted">{row.day}</span>
                  <div className="hsk-bar-track">
                    <div
                      className="hsk-bar-fill"
                      style={{ width: `${Math.min(100, Number(row.avgPercent) || 0)}%` }}
                    />
                  </div>
                  <strong>{Number(row.avgPercent) || 0}%</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'dictionary' && (
        <div className="hsk-panel">
          <h2>Личный словарь</h2>
          {words.length === 0 ? (
            <p className="hsk-muted">Словарь пуст. Сохраняйте слова после тренировок.</p>
          ) : (
            <ul className="hsk-list">
              {words.map((w) => (
                <li key={w.id}>
                  <div>
                    <strong className="hsk-hanzi">{w.word}</strong>
                    {w.pinyin ? <span className="hsk-muted"> · {w.pinyin}</span> : null}
                    {w.translation ? <div className="hsk-muted">{w.translation}</div> : null}
                    <div className="hsk-muted">{w.status || 'saved'}</div>
                  </div>
                  <div className="hsk-inline-actions">
                    {w.status !== 'learned' ? (
                      <button type="button" className="hsk-btn hsk-btn--ghost hsk-btn--sm" onClick={() => markLearned(w.id)}>
                        Выучено
                      </button>
                    ) : null}
                    <button type="button" className="hsk-btn hsk-btn--ghost hsk-btn--sm" onClick={() => removeWord(w.id)}>
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'favorites' && (
        <div className="hsk-panel">
          <h2>Избранное</h2>
          <p className="hsk-muted">Сохранено: {favorites.length}</p>
          {favorites.length > 0 ? (
            <ul className="hsk-list">
              {favorites.map((f) => (
                <li key={f.id}>
                  <span className="hsk-muted">{f.contentKind || f.content_kind} · {String(f.contentId || f.content_id).slice(0, 8)}…</span>
                  <button type="button" className="hsk-btn hsk-btn--ghost hsk-btn--sm" onClick={() => removeFavorite(f.id)}>
                    Убрать
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="hsk-actions">
            <Link className="hsk-btn" to={`${createPageUrl('HskAcademyPractice')}?mode=favorites`}>
              Тренировать избранное
            </Link>
          </div>
        </div>
      )}

      {tab === 'review' && (
        <div className="hsk-panel">
          <h2>Нужно повторить</h2>
          <p className="hsk-muted">Активных ошибок: {review.length}</p>
          {review.length > 0 ? (
            <ul className="hsk-list">
              {review.slice(0, 20).map((r) => (
                <li key={r.id}>
                  <span>
                    Ошибок: {r.wrongCount || r.wrong_count || 1}
                    {r.lastWrongAt || r.last_wrong_at
                      ? ` · ${new Date(r.lastWrongAt || r.last_wrong_at).toLocaleDateString()}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="hsk-actions">
            <Link className="hsk-btn" to={`${createPageUrl('HskAcademyPractice')}?mode=error_review`}>
              Начать повторение
            </Link>
          </div>
        </div>
      )}

      {tab === 'achievements' && (
        <div className="hsk-panel">
          <h2>Достижения</h2>
          {achievements.length === 0 ? (
            <p className="hsk-muted">Пока нет достижений — продолжайте подготовку.</p>
          ) : (
            <ul className="hsk-list">
              {achievements.map((row) => (
                <li key={row.id}>
                  <strong>{row.achievement?.title || row.achievementId}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </HskAcademyShell>
  );
}
