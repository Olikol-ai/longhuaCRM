import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { userFacingError } from '@/lib/userFacingError';
import {
  buildStructureFromWizardSections,
  contentStatusLabel,
  formatMinutesLabel,
  wizardSectionsFromStructure,
} from '@/lib/examContentLabels';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Экзамен и уровень' },
  { id: 2, title: 'Разделы и время' },
  { id: 3, title: 'Наполнение' },
  { id: 4, title: 'Предпросмотр' },
  { id: 5, title: 'Публикация' },
];

const fieldCls =
  'h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:h-10 md:min-h-10 md:text-sm';

/**
 * 5-step test wizard — create or edit any edition status.
 */
export default function TestWizard({
  initialEditionId = '',
  initialBlueprintId = '',
  onClose,
  onSaved,
}) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [programs, setPrograms] = useState([]);
  const [versions, setVersions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [taxSections, setTaxSections] = useState([]);
  const [bankItems, setBankItems] = useState([]);

  const [programCode, setProgramCode] = useState('hsk');
  const [versionCode, setVersionCode] = useState('hsk_2_0');
  const [levelId, setLevelId] = useState('');
  const [testName, setTestName] = useState('');
  const [blueprintId, setBlueprintId] = useState(initialBlueprintId || '');
  const [editionId, setEditionId] = useState(initialEditionId || '');
  const [editionStatus, setEditionStatus] = useState('draft');
  const [sections, setSections] = useState([]);
  const [previewParts, setPreviewParts] = useState(null);

  const versionId = useMemo(
    () => versions.find((v) => v.code === versionCode)?.id || '',
    [versions, versionCode],
  );

  const totalMinutes = useMemo(
    () =>
      sections.filter((s) => s.enabled).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0),
    [sections],
  );

  useEffect(() => {
    api.examContent.taxonomy
      .programs()
      .then((rows) => setPrograms(Array.isArray(rows) ? rows : []))
      .catch(() => setPrograms([{ code: 'hsk', title: 'HSK' }]));
  }, []);

  useEffect(() => {
    if (!programCode) return;
    api.examContent.taxonomy
      .versions(programCode)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setVersions(list);
        if (!list.find((v) => v.code === versionCode) && list[0]) {
          setVersionCode(list[0].code);
        }
      })
      .catch((err) => setError(userFacingError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programCode]);

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

  useEffect(() => {
    if (!levelId) return;
    api.examContent.taxonomy
      .sections(levelId)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setTaxSections(list);
        setSections((prev) => {
          if (prev.length && editionId) return prev;
          return list.map((s) => ({
            sectionKey: s.sectionKey || s.section_key,
            title: s.title,
            enabled: true,
            minutes: Math.max(1, Math.round((s.defaultDurationSeconds || s.default_duration_seconds || 900) / 60)),
            fillMode: 'auto',
            easyCount: 5,
            midCount: 5,
            hardCount: 0,
            itemIds: [],
          }));
        });
      })
      .catch(() => setTaxSections([]));
  }, [levelId, editionId]);

  useEffect(() => {
    if (!editionId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.examContent.editions.structure(editionId);
        if (cancelled) return;
        const edition = data.edition || data;
        setEditionStatus(edition.status || 'draft');
        setTestName(edition.title || '');
        setBlueprintId(edition.blueprint_id || edition.blueprintId || blueprintId);
        const structure = {
          sections: (data.sections || []).map((s) => ({
            section_key: s.sectionKey || s.section_key,
            title: s.title,
            duration_seconds: s.durationSeconds ?? s.duration_seconds,
            blocks: (s.blocks || []).map((b) => ({
              title: b.title,
              slots: (b.slots || []).map((sl) => ({
                sort_order: sl.sortOrder ?? sl.sort_order,
                slot_kind: sl.slotKind || sl.slot_kind,
                fixed_item_id: sl.fixedItemId || sl.fixed_item_id,
                rule: sl.selectionRule || sl.selection_rule
                  ? {
                      select_count:
                        (sl.selectionRule || sl.selection_rule).selectCount ??
                        (sl.selectionRule || sl.selection_rule).select_count,
                      difficulty_min:
                        (sl.selectionRule || sl.selection_rule).difficultyMin ??
                        (sl.selectionRule || sl.selection_rule).difficulty_min,
                      difficulty_max:
                        (sl.selectionRule || sl.selection_rule).difficultyMax ??
                        (sl.selectionRule || sl.selection_rule).difficulty_max,
                    }
                  : sl.rule,
              })),
            })),
          })),
        };
        const tax = await api.examContent.taxonomy.sections(
          edition.blueprint?.level_id ||
            edition.blueprint?.levelId ||
            levelId,
        ).catch(() => taxSections);
        setSections(wizardSectionsFromStructure(structure, Array.isArray(tax) ? tax : taxSections));
      } catch (err) {
        if (!cancelled) setError(userFacingError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId]);

  useEffect(() => {
    if (step !== 3 || !levelId || !versionId) return;
    api.examContent.items
      .list({ levelId, versionId, status: 'published' })
      .then((rows) => setBankItems(Array.isArray(rows) ? rows : []))
      .catch(() => setBankItems([]));
  }, [step, levelId, versionId]);

  const ensureEdition = async () => {
    if (editionId) return editionId;
    if (!levelId || !testName.trim()) {
      throw new Error('Укажите уровень и название теста');
    }
    const bp = await api.examContent.blueprints.create({
      level_id: levelId,
      name: testName.trim(),
    });
    const editions = bp.editions || [];
    const draft = editions[0];
    if (!draft?.id) throw new Error('Не удалось создать версию теста');
    setBlueprintId(bp.id);
    setEditionId(draft.id);
    setEditionStatus(draft.status || 'draft');
    return draft.id;
  };

  const saveStructure = async () => {
    const id = await ensureEdition();
    const payload = buildStructureFromWizardSections(sections);
    await api.examContent.editions.saveStructure(id, payload);
    setEditionId(id);
    return id;
  };

  const goNext = async () => {
    setError('');
    setOk('');
    setBusy(true);
    try {
      if (step === 1) {
        if (!testName.trim()) throw new Error('Введите название теста');
        if (!levelId) throw new Error('Выберите уровень');
        await ensureEdition();
      }
      if (step === 2 || step === 3) {
        await saveStructure();
        setOk('Сохранено');
      }
      if (step === 3) {
        const id = editionId || (await ensureEdition());
        try {
          const gen = await api.examContent.generate({
            blueprint_edition_id: id,
            level_id: levelId,
          });
          setPreviewParts(gen);
        } catch (genErr) {
          setPreviewParts({ error: userFacingError(genErr), parts: [] });
        }
      }
      setStep((s) => Math.min(5, s + 1));
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  };

  const saveDraft = async () => {
    setBusy(true);
    setError('');
    try {
      await saveStructure();
      setOk(editionStatus === 'published' ? 'Изменения сохранены' : 'Черновик сохранён');
      onSaved?.();
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    setError('');
    try {
      const id = await saveStructure();
      await api.examContent.editions.publish(id);
      setEditionStatus('published');
      setOk('Тест опубликован');
      onSaved?.();
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  const updateSection = (key, patch) => {
    setSections((rows) =>
      rows.map((s) => (s.sectionKey === key ? { ...s, ...patch } : s)),
    );
  };

  const toggleItem = (sectionKey, itemId) => {
    setSections((rows) =>
      rows.map((s) => {
        if (s.sectionKey !== sectionKey) return s;
        const set = new Set(s.itemIds || []);
        if (set.has(itemId)) set.delete(itemId);
        else set.add(itemId);
        return { ...s, itemIds: [...set], fillMode: 'manual' };
      }),
    );
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            {editionId ? 'Редактирование теста' : 'Новый тест'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Шаг {step} из 5 · {STEPS[step - 1].title}
            {editionId ? ` · ${contentStatusLabel(editionStatus)}` : ''}
          </p>
        </div>
        <Button type="button" variant="ghost" className="min-h-10" onClick={onClose}>
          К списку
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={cn(
              'shrink-0 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm border transition-colors',
              step === s.id
                ? 'border-brand bg-brand/10 text-brand font-medium'
                : step > s.id
                  ? 'border-border bg-muted/40 text-foreground'
                  : 'border-border text-muted-foreground',
            )}
            onClick={() => step > s.id && setStep(s.id)}
          >
            {s.id}. {s.title}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-muted-foreground">{ok}</p> : null}

      {step === 1 ? (
        <Card className="p-4 space-y-3 border-border">
          <label className="text-sm space-y-1.5 block">
            <span className="text-muted-foreground">Экзамен</span>
            <select
              className={fieldCls}
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
              disabled={Boolean(editionId)}
            >
              {(programs.length ? programs : [{ code: 'hsk', title: 'HSK' }]).map((p) => (
                <option key={p.code || p.id} value={p.code}>
                  {p.title || p.code}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1.5 block">
            <span className="text-muted-foreground">Версия</span>
            <select
              className={fieldCls}
              value={versionCode}
              onChange={(e) => setVersionCode(e.target.value)}
              disabled={Boolean(editionId)}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.code}>
                  {v.title || v.code}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1.5 block">
            <span className="text-muted-foreground">Уровень</span>
            <select
              className={fieldCls}
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
              disabled={Boolean(editionId)}
            >
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1.5 block">
            <span className="text-muted-foreground">Название теста</span>
            <Input
              className="h-11"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="Например: Пробный HSK 3 · весна"
            />
          </label>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="p-4 space-y-4 border-border">
          <p className="text-sm text-muted-foreground">
            Отметьте разделы и укажите время в минутах. Общее время:{' '}
            <strong>{formatMinutesLabel(totalMinutes)}</strong>
          </p>
          <ul className="space-y-3">
            {sections.map((s) => (
              <li
                key={s.sectionKey}
                className="rounded-lg border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <label className="flex items-center gap-2 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={s.enabled}
                    onChange={(e) => updateSection(s.sectionKey, { enabled: e.target.checked })}
                  />
                  <span className="font-medium truncate">{s.title}</span>
                </label>
                <label className="text-sm flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground">Минут</span>
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    className="h-10 w-20"
                    disabled={!s.enabled}
                    value={s.minutes}
                    onChange={(e) =>
                      updateSection(s.sectionKey, { minutes: Number(e.target.value) || 1 })
                    }
                  />
                </label>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          {sections
            .filter((s) => s.enabled)
            .map((s) => (
              <Card key={s.sectionKey} className="p-4 space-y-3 border-border">
                <h3 className="font-medium">{s.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={s.fillMode === 'auto' ? 'default' : 'outline'}
                    className="min-h-10"
                    onClick={() => updateSection(s.sectionKey, { fillMode: 'auto' })}
                  >
                    Автоподбор
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={s.fillMode === 'manual' ? 'default' : 'outline'}
                    className="min-h-10"
                    onClick={() => updateSection(s.sectionKey, { fillMode: 'manual' })}
                  >
                    Ручной выбор
                  </Button>
                </div>
                {s.fillMode === 'auto' ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['easyCount', 'Лёгкие'],
                      ['midCount', 'Средние'],
                      ['hardCount', 'Сложные'],
                    ].map(([key, label]) => (
                      <label key={key} className="text-sm space-y-1">
                        <span className="text-muted-foreground">{label}</span>
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          className="h-10"
                          value={s[key]}
                          onChange={(e) =>
                            updateSection(s.sectionKey, { [key]: Number(e.target.value) || 0 })
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1 border border-border rounded-md p-2">
                    {bankItems
                      .filter(
                        (it) =>
                          (it.sectionKey || it.section_key) === s.sectionKey ||
                          !s.sectionKey,
                      )
                      .map((it) => {
                        const id = it.id;
                        const checked = (s.itemIds || []).includes(id);
                        return (
                          <label
                            key={id}
                            className="flex items-start gap-2 text-sm py-1.5 px-1 rounded hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={() => toggleItem(s.sectionKey, id)}
                            />
                            <span className="min-w-0 line-clamp-2">{it.stem || id}</span>
                          </label>
                        );
                      })}
                    {!bankItems.length ? (
                      <p className="text-sm text-muted-foreground p-2">
                        Нет опубликованных вопросов. Создайте их в банке.
                      </p>
                    ) : null}
                  </div>
                )}
              </Card>
            ))}
        </div>
      ) : null}

      {step === 4 ? (
        <Card className="p-4 space-y-3 border-border">
          <h3 className="font-medium">Как увидит ученик</h3>
          <p className="text-sm text-muted-foreground">
            Общее время: {formatMinutesLabel(totalMinutes)}. Разделы:{' '}
            {sections
              .filter((s) => s.enabled)
              .map((s) => `${s.title} (${s.minutes} мин)`)
              .join(', ')}
            .
          </p>
          {previewParts?.error ? (
            <p className="text-sm text-destructive">{previewParts.error}</p>
          ) : null}
          <ul className="space-y-3">
            {(previewParts?.parts || []).map((part, idx) => (
              <li key={idx} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">
                  {part.title || part.partKind} · заданий: {part.selectCount ?? part.pool?.length ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  В банке для подбора: {part.pool?.length ?? 0}
                </p>
              </li>
            ))}
          </ul>
          {!previewParts?.parts?.length && !previewParts?.error ? (
            <p className="text-sm text-muted-foreground">Нет данных предпросмотра.</p>
          ) : null}
        </Card>
      ) : null}

      {step === 5 ? (
        <Card className="p-4 space-y-4 border-border">
          <p className="text-sm text-muted-foreground">
            Текущий статус: <strong>{contentStatusLabel(editionStatus)}</strong>
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={saveDraft}
            >
              {editionStatus === 'published' ? 'Сохранить' : 'Сохранить черновик'}
            </Button>
            {editionStatus !== 'published' ? (
              <Button type="button" className="min-h-11" disabled={busy} onClick={publish}>
                Опубликовать
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row gap-2 justify-between pt-1">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-1"
          disabled={step <= 1 || busy}
          onClick={goBack}
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </Button>
        {step < 5 ? (
          <Button type="button" className="min-h-11 gap-1" disabled={busy} onClick={goNext}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Далее
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            Готово
          </Button>
        )}
      </div>
    </div>
  );
}
