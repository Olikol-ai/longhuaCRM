import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';

export default function HskAcademyPractice() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = params.get('mode') || 'practice';
  const [versions, setVersions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [sections, setSections] = useState([]);
  const [versionCode, setVersionCode] = useState('hsk_2_0');
  const [levelId, setLevelId] = useState('');
  const [sectionKey, setSectionKey] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({ favorites: 0, review: 0 });

  useEffect(() => {
    api.examAcademy.catalog
      .versions('hsk')
      .then((rows) => setVersions(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(userFacingError(err)));
    if (mode === 'favorites' || mode === 'error_review') {
      api.examAcademy.me
        .preparation()
        .then((prep) => {
          setCounts({
            favorites: prep?.summary?.favorites_count ?? 0,
            review: prep?.summary?.review_count ?? 0,
          });
        })
        .catch(() => {});
    }
  }, [mode]);

  useEffect(() => {
    if (!versionCode) return;
    api.examAcademy.catalog
      .levels(versionCode)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setLevels(list);
        setLevelId(list[0]?.id || '');
      })
      .catch((err) => setError(userFacingError(err)));
  }, [versionCode]);

  useEffect(() => {
    if (!levelId) return;
    api.examAcademy.catalog
      .sections(levelId)
      .then((rows) => setSections(Array.isArray(rows) ? rows : []))
      .catch(() => setSections([]));
  }, [levelId]);

  const versionId = useMemo(
    () => versions.find((v) => v.code === versionCode)?.id || '',
    [versions, versionCode],
  );

  const emptyHint =
    mode === 'favorites' && counts.favorites === 0
      ? 'В избранном пока пусто. Добавьте задания с экрана результата.'
      : mode === 'error_review' && counts.review === 0
        ? 'Ошибок для повторения нет. Пройдите тренировку — неверные ответы появятся здесь.'
        : '';

  const start = async () => {
    if (emptyHint) {
      setError(emptyHint);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const session = await api.examAcademy.sessions.create({
        mode,
        program_version_id: versionId,
        level_id: levelId,
        section_key: sectionKey || undefined,
        question_count: mode === 'practice' ? Number(questionCount) || 10 : undefined,
        randomize: true,
        show_correct_answers: mode === 'practice' ? 'after_item' : 'after_submit',
      });
      await api.examAcademy.sessions.start(session.id);
      navigate(`${createPageUrl('HskAcademyTake')}?sessionId=${session.id}`);
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === 'error_review'
      ? 'Тренировка ошибок'
      : mode === 'favorites'
        ? 'Избранные вопросы'
        : 'Тренировка';

  return (
    <HskAcademyShell active="practice">
      <section className="hsk-hero">
        <p className="hsk-kicker">Practice Mode</p>
        <h1>{title}</h1>
        <p className="hsk-lead">Настройте параметры и начните подготовку.</p>
      </section>

      <div className="hsk-panel">
        <div className="hsk-form-grid">
          {mode === 'practice' ? (
            <>
              <label>
                Версия
                <select value={versionCode} onChange={(e) => setVersionCode(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.code}>
                      {v.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Уровень
                <select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Раздел
                <select value={sectionKey} onChange={(e) => setSectionKey(e.target.value)}>
                  <option value="">Все разделы</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.sectionKey || s.section_key}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Количество заданий
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <p className="hsk-muted hsk-span-2">
                Сессия будет собрана автоматически из{' '}
                {mode === 'favorites' ? `избранного (${counts.favorites})` : `ошибок (${counts.review})`}.
                Версия и уровень используются для статистики.
              </p>
              <label>
                Версия
                <select value={versionCode} onChange={(e) => setVersionCode(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.code}>
                      {v.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Уровень
                <select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        {emptyHint ? <p className="hsk-muted">{emptyHint}</p> : null}
        {error ? <p className="hsk-error">{error}</p> : null}
        <div className="hsk-actions">
          <button
            type="button"
            className="hsk-btn"
            disabled={busy || !versionId || !levelId || Boolean(emptyHint)}
            onClick={start}
          >
            {busy ? 'Запуск…' : 'Начать'}
          </button>
          {emptyHint ? (
            <Link className="hsk-btn hsk-btn--ghost" to={createPageUrl('HskAcademyPractice')}>
              Обычная тренировка
            </Link>
          ) : null}
        </div>
      </div>
    </HskAcademyShell>
  );
}
