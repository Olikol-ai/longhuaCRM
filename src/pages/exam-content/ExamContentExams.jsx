import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import ExamContentShell from '@/components/exam-content/ExamContentShell';
import TestWizard from '@/components/exam-content/TestWizard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { userFacingError } from '@/lib/userFacingError';
import {
  contentStatusLabel,
  formatMinutesLabel,
  secondsToMinutes,
} from '@/lib/examContentLabels';

const fieldCls =
  'h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:h-10 md:min-h-10 md:text-sm';

export default function ExamContentExams() {
  const [versions, setVersions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [versionCode, setVersionCode] = useState('hsk_2_0');
  const [levelId, setLevelId] = useState('');
  const [blueprints, setBlueprints] = useState([]);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('list');
  const [editEditionId, setEditEditionId] = useState('');
  const [editBlueprintId, setEditBlueprintId] = useState('');

  const versionId = useMemo(
    () => versions.find((v) => v.code === versionCode)?.id || '',
    [versions, versionCode],
  );

  useEffect(() => {
    api.examContent.taxonomy
      .versions('hsk')
      .then((rows) => setVersions(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(userFacingError(err)));
  }, []);

  useEffect(() => {
    if (!versionCode) return;
    api.examContent.taxonomy
      .levels(versionCode)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setLevels(list);
        setLevelId((prev) => prev || list[0]?.id || '');
      })
      .catch((err) => setError(userFacingError(err)));
  }, [versionCode]);

  const reload = async () => {
    if (!levelId) return;
    const rows = await api.examContent.blueprints.list(levelId);
    setBlueprints(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    reload().catch((err) => setError(userFacingError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId]);

  const openEdit = (blueprintId, editionId) => {
    setEditBlueprintId(blueprintId);
    setEditEditionId(editionId);
    setMode('wizard');
  };

  const startCreate = () => {
    setEditBlueprintId('');
    setEditEditionId('');
    setMode('wizard');
  };

  if (mode === 'wizard') {
    return (
      <ExamContentShell
        active="exams"
        title="Тесты"
        description="Пошаговое создание и редактирование тестов."
      >
        <TestWizard
          initialEditionId={editEditionId}
          initialBlueprintId={editBlueprintId}
          onClose={() => {
            setMode('list');
            reload().catch(() => {});
          }}
          onSaved={() => reload().catch(() => {})}
        />
      </ExamContentShell>
    );
  }

  const rows = [];
  for (const bp of blueprints) {
    const editions = [...(bp.editions || [])].sort(
      (a, b) => (b.revision || 0) - (a.revision || 0),
    );
    for (const ed of editions) {
      rows.push({
        key: ed.id,
        blueprintId: bp.id,
        blueprintName: bp.name,
        editionId: ed.id,
        title: ed.title || bp.name,
        status: ed.status,
        minutes: secondsToMinutes(ed.totalDurationSeconds ?? ed.total_duration_seconds),
        revision: ed.revision,
      });
    }
  }

  return (
    <ExamContentShell
      active="exams"
      title="Тесты"
      description="Создавайте тесты пошагово. Любой тест можно снова открыть и изменить."
    >
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div className="grid gap-2 sm:grid-cols-2 flex-1 max-w-xl">
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Версия</span>
            <select
              className={fieldCls}
              value={versionCode}
              onChange={(e) => setVersionCode(e.target.value)}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.code}>
                  {v.title || v.code}
                </option>
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
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button type="button" className="min-h-11 shrink-0" onClick={startCreate} disabled={!levelId}>
          Создать тест
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!versionId ? null : null}

      <Card className="border-border overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">
            Пока нет тестов для этого уровня. Нажмите «Создать тест».
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li
                key={row.key}
                className="px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {contentStatusLabel(row.status)}
                    {row.minutes ? ` · ${formatMinutesLabel(row.minutes)}` : ''}
                    {row.revision ? ` · версия ${row.revision}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10 shrink-0"
                  onClick={() => openEdit(row.blueprintId, row.editionId)}
                >
                  Открыть / Редактировать
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </ExamContentShell>
  );
}
