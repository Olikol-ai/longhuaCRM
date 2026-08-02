import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';
import ExamPrepScreen from '@/components/hsk-academy/ExamPrepScreen';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const fieldCls =
  'w-full h-11 rounded-md border border-input bg-background px-3 text-sm';

export default function HskAcademyPractice() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = params.get('mode') || 'practice';
  const [step, setStep] = useState('configure');
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
    setStep('configure');
  }, [mode]);

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
  const versionTitle = versions.find((v) => v.code === versionCode)?.title || versionCode;
  const levelTitle = levels.find((l) => l.id === levelId)?.title || '—';
  const sectionTitle =
    sections.find((s) => (s.sectionKey || s.section_key) === sectionKey)?.title ||
    (sectionKey ? sectionKey : 'Все разделы');

  const emptyHint =
    mode === 'favorites' && counts.favorites === 0
      ? 'В избранном пока пусто. Добавьте задания с экрана результата.'
      : mode === 'error_review' && counts.review === 0
        ? 'Ошибок для повторения нет. Пройдите тренировку — неверные ответы появятся здесь.'
        : '';

  const title =
    mode === 'error_review'
      ? 'Тренировка ошибок'
      : mode === 'favorites'
        ? 'Избранные вопросы'
        : 'Тренировка';

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

  return (
    <HskAcademyShell active="practice">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {step === 'configure'
            ? 'Настройте параметры, затем откройте экран подготовки.'
            : 'Проверьте параметры и нажмите «Начать экзамен».'}
        </p>
      </div>

      {step === 'configure' ? (
        <Card className="p-5 space-y-4 border-border">
          <div className="grid gap-3 sm:grid-cols-2">
            {mode === 'practice' ? (
              <>
                <label className="text-sm space-y-1">
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
                <label className="text-sm space-y-1">
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
                <label className="text-sm space-y-1">
                  <span className="text-muted-foreground">Раздел</span>
                  <select
                    className={fieldCls}
                    value={sectionKey}
                    onChange={(e) => setSectionKey(e.target.value)}
                  >
                    <option value="">Все разделы</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.sectionKey || s.section_key}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-muted-foreground">Количество заданий</span>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    className="h-11"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Сессия будет собрана из{' '}
                  {mode === 'favorites'
                    ? `избранного (${counts.favorites})`
                    : `ошибок (${counts.review})`}
                  .
                </p>
                <label className="text-sm space-y-1">
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
                <label className="text-sm space-y-1">
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
              </>
            )}
          </div>
          {emptyHint ? <p className="text-sm text-muted-foreground">{emptyHint}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11"
              disabled={!versionId || !levelId || Boolean(emptyHint)}
              onClick={() => {
                setError('');
                setStep('prep');
              }}
            >
              Далее
            </Button>
            {emptyHint ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link to={createPageUrl('HskAcademyPractice')}>Обычная тренировка</Link>
              </Button>
            ) : null}
          </div>
        </Card>
      ) : (
        <ExamPrepScreen
          title={title}
          lead="Проверьте параметры перед стартом. После старта откроется режим экзамена."
          metaRows={[
            { label: 'Режим', value: title },
            { label: 'Версия', value: versionTitle },
            { label: 'Уровень', value: levelTitle },
            {
              label: 'Раздел',
              value: mode === 'practice' ? sectionTitle : 'Авто',
            },
            {
              label: 'Заданий',
              value:
                mode === 'practice'
                  ? String(questionCount)
                  : mode === 'favorites'
                    ? String(counts.favorites)
                    : String(counts.review),
            },
            { label: 'Подсказки', value: mode === 'practice' ? 'После ответа' : 'После сдачи' },
          ]}
          tips={[
            'Можно помечать задания и возвращаться к ним.',
            'Ответы сохраняются автоматически; при обрыве сети — локальный черновик.',
            'На мобильном используйте крупные кнопки внизу экрана.',
          ]}
          busy={busy}
          error={error}
          onBack={() => setStep('configure')}
          onStart={start}
          startLabel="Начать экзамен"
        />
      )}
    </HskAcademyShell>
  );
}
