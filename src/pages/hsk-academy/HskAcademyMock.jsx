import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';
import ExamPrepScreen from '@/components/hsk-academy/ExamPrepScreen';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const fieldCls =
  'h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:h-10 md:min-h-10 md:text-sm';

export default function HskAcademyMock() {
  const [params] = useSearchParams();
  const mode = params.get('mode') || 'mock_exam';
  const navigate = useNavigate();
  const [step, setStep] = useState('configure');
  const [versions, setVersions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [blueprints, setBlueprints] = useState([]);
  const [versionCode, setVersionCode] = useState('hsk_2_0');
  const [levelId, setLevelId] = useState('');
  const [blueprintId, setBlueprintId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStep('configure');
  }, [mode]);

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
  const versionTitle = versions.find((v) => v.code === versionCode)?.title || versionCode;
  const levelTitle = levels.find((l) => l.id === levelId)?.title || '—';
  const blueprint = blueprints.find((b) => b.id === blueprintId);
  const durationSec =
    blueprint?.totalDurationSeconds ??
    blueprint?.total_duration_seconds ??
    null;

  const title = mode === 'random_exam' ? 'Случайный экзамен' : 'Пробный экзамен';

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
      navigate(`${createPageUrl('HskAcademyTake')}?sessionId=${session.id}&from=mock`);
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HskAcademyShell
      active="mock"
      title={title}
      description="Структура и таймер как на официальном экзамене. Подсказки до завершения отключены."
    >
      {step === 'configure' ? (
        <Card className="p-4 sm:p-5 space-y-4 border-border max-w-2xl">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm space-y-1.5 block">
              <span className="text-muted-foreground">Версия</span>
              <select
                className={fieldCls}
                value={versionCode}
                onChange={(e) => setVersionCode(e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.code}>{v.title}</option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1.5 block">
              <span className="text-muted-foreground">Уровень</span>
              <select
                className={fieldCls}
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
              >
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1.5 block sm:col-span-2">
              <span className="text-muted-foreground">Структура</span>
              <select
                className={fieldCls}
                value={blueprintId}
                onChange={(e) => setBlueprintId(e.target.value)}
              >
                {blueprints.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={!versionId || !levelId}
            onClick={() => {
              setError('');
              setStep('prep');
            }}
          >
            Далее
          </Button>
        </Card>
      ) : (
        <ExamPrepScreen
          title={title}
          lead="Убедитесь, что у вас достаточно времени без перерывов."
          metaRows={[
            { label: 'Версия', value: versionTitle },
            { label: 'Уровень', value: levelTitle },
            { label: 'Структура', value: blueprint?.name || '—' },
            {
              label: 'Длительность',
              value:
                durationSec != null
                  ? `${Math.max(1, Math.ceil(Number(durationSec) / 60))} мин`
                  : 'По шаблону',
            },
            { label: 'Подсказки', value: 'После сдачи' },
            { label: 'Режим', value: mode === 'random_exam' ? 'Случайный вариант' : 'Пробный' },
          ]}
          tips={[
            'Таймер синхронизирован с сервером',
            'Можно пропускать задания и возвращаться через навигацию',
          ]}
          busy={busy}
          error={error}
          onBack={() => setStep('configure')}
          onStart={start}
        />
      )}
    </HskAcademyShell>
  );
}
