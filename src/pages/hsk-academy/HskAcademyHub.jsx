import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardCheck, Database, RefreshCw, Sparkles, Star, Trophy } from 'lucide-react';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';

export default function HskAcademyHub() {
  const { user } = useAuth();
  const canBank = ['admin', 'teacher', 'tutor'].includes(user?.role);
  const [prep, setPrep] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.examAcademy.me.preparation();
        if (!cancelled) setPrep(data);
      } catch (err) {
        if (!cancelled) setError(userFacingError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = prep?.summary || {};
  const history = prep?.history || [];
  const inProgress = history.filter((s) => s.status === 'in_progress');

  return (
    <HskAcademyShell active="hub">
      <section className="hsk-hero">
        <p className="hsk-kicker">Longhua Exam Academy</p>
        <h1>HSK Academy</h1>
        <p className="hsk-lead">
          Специализированная платформа подготовки к международным экзаменам. Тренируйтесь в
          формате, близком к реальному HSK — на оригинальных заданиях Longhua.
        </p>
      </section>

      {error ? <p className="hsk-error">{error}</p> : null}

      {inProgress.length > 0 ? (
        <div className="hsk-panel">
          <h2>Продолжить</h2>
          <ul className="hsk-list">
            {inProgress.slice(0, 3).map((row) => (
              <li key={row.id}>
                <span>{row.title || row.mode}</span>
                <Link className="hsk-btn hsk-btn--sm" to={`${createPageUrl('HskAcademyTake')}?sessionId=${row.id}`}>
                  Открыть
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="hsk-mode-grid">
        <Link className="hsk-mode-card" to={createPageUrl('HskAcademyPractice')}>
          <Sparkles size={22} />
          <h2>Тренировка</h2>
          <p>Выберите версию, уровень и раздел. Можно проходить бесконечно.</p>
        </Link>
        <Link className="hsk-mode-card" to={createPageUrl('HskAcademyMock')}>
          <ClipboardCheck size={22} />
          <h2>Пробный экзамен</h2>
          <p>Таймер, структура частей и последовательность как на экзамене.</p>
        </Link>
        <Link className="hsk-mode-card" to={createPageUrl('HskAcademyPreparation')}>
          <BookOpen size={22} />
          <h2>Моя подготовка</h2>
          <p>История, словарь, ошибки, избранное и динамика.</p>
        </Link>
        <Link className="hsk-mode-card" to={`${createPageUrl('HskAcademyPractice')}?mode=error_review`}>
          <RefreshCw size={22} />
          <h2>Нужно повторить</h2>
          <p>
            Автоматическая тренировка по вашим ошибкам
            {summary.review_count != null ? ` (${summary.review_count})` : ''}.
          </p>
        </Link>
        <Link className="hsk-mode-card" to={`${createPageUrl('HskAcademyPractice')}?mode=favorites`}>
          <Star size={22} />
          <h2>Избранное</h2>
          <p>
            Сохранённые задания для повторной практики
            {summary.favorites_count != null ? ` (${summary.favorites_count})` : ''}.
          </p>
        </Link>
        <Link className="hsk-mode-card" to={`${createPageUrl('HskAcademyMock')}?mode=random_exam`}>
          <Trophy size={22} />
          <h2>Случайный экзамен</h2>
          <p>Каждый запуск — новый вариант из банка.</p>
        </Link>
        {canBank ? (
          <Link className="hsk-mode-card" to={createPageUrl('HskAcademyBank')}>
            <Database size={22} />
            <h2>Банк заданий</h2>
            <p>Создание, публикация и архивация контента Academy.</p>
          </Link>
        ) : null}
      </section>

      <section className="hsk-stats-row">
        {loading ? (
          <p className="hsk-muted">Загрузка статистики…</p>
        ) : (
          <>
            <div className="hsk-stat">
              <span>Тренировки</span>
              <strong>{summary.practice_count ?? 0}</strong>
            </div>
            <div className="hsk-stat">
              <span>Экзамены</span>
              <strong>{summary.mock_count ?? 0}</strong>
            </div>
            <div className="hsk-stat">
              <span>Средний %</span>
              <strong>{summary.average_percent ?? 0}</strong>
            </div>
            <div className="hsk-stat">
              <span>Лучший %</span>
              <strong>{summary.best_percent ?? 0}</strong>
            </div>
            <div className="hsk-stat">
              <span>Повторить</span>
              <strong>{summary.review_count ?? 0}</strong>
            </div>
            <div className="hsk-stat">
              <span>Словарь</span>
              <strong>{summary.dictionary_count ?? 0}</strong>
            </div>
          </>
        )}
      </section>
    </HskAcademyShell>
  );
}
