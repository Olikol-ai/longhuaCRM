import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';

export default function HskAcademyMock() {
  const [params] = useSearchParams();
  const mode = params.get('mode') || 'mock_exam';
  const navigate = useNavigate();
  const [versions, setVersions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [blueprints, setBlueprints] = useState([]);
  const [versionCode, setVersionCode] = useState('hsk_2_0');
  const [levelId, setLevelId] = useState('');
  const [blueprintId, setBlueprintId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.examAcademy.catalog
      .versions('hsk')
      .then((rows) => setVersions(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(userFacingError(err)));
  }, []);

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
      .blueprints(levelId)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setBlueprints(list);
        setBlueprintId(list[0]?.id || '');
      })
      .catch(() => setBlueprints([]));
  }, [levelId]);

  const versionId = useMemo(
    () => versions.find((v) => v.code === versionCode)?.id || '',
    [versions, versionCode],
  );

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const session = await api.examAcademy.sessions.create({
        mode,
        program_version_id: versionId,
        level_id: levelId,
        blueprint_id: blueprintId || undefined,
        randomize: true,
        show_correct_answers: 'after_submit',
      });
      await api.examAcademy.sessions.start(session.id);
      navigate(`${createPageUrl('HskAcademyTake')}?sessionId=${session.id}`);
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HskAcademyShell active="mock">
      <section className="hsk-hero">
        <p className="hsk-kicker">Exam Simulation</p>
        <h1>{mode === 'random_exam' ? 'Случайный экзамен' : 'Пробный экзамен'}</h1>
        <p className="hsk-lead">
          Максимально близко к структуре официального экзамена. Подсказки отключены до завершения.
        </p>
      </section>

      <div className="hsk-panel">
        <div className="hsk-form-grid">
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
            Структура
            <select value={blueprintId} onChange={(e) => setBlueprintId(e.target.value)}>
              {blueprints.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="hsk-error">{error}</p> : null}
        <div className="hsk-actions">
          <button type="button" className="hsk-btn" disabled={busy || !versionId || !levelId} onClick={start}>
            {busy ? 'Подготовка…' : 'Начать экзамен'}
          </button>
        </div>
      </div>
    </HskAcademyShell>
  );
}
