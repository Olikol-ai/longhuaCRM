import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import ExamContentShell from '@/components/exam-content/ExamContentShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userFacingError } from '@/lib/userFacingError';

function defaultStructure() {
  return {
    total_duration_seconds: 2400,
    sections: [
      {
        section_key: 'listening',
        title: 'Listening',
        sort_order: 0,
        duration_seconds: 1200,
        weight_percent: 50,
        blocks: [
          {
            title: 'Part 1',
            sort_order: 0,
            duration_seconds: 600,
            slots: [
              {
                sort_order: 0,
                slot_kind: 'rule',
                rule: {
                  select_count: 5,
                  difficulty_min: 1,
                  difficulty_max: 3,
                  exclude_recent_days: 30,
                  deny_duplicate_media: true,
                  allow_reuse_if_pool_short: false,
                  max_topic_share_percent: 30,
                  min_mid_difficulty_share_percent: 20,
                  item_type_codes: ['single_choice'],
                },
              },
            ],
          },
        ],
      },
      {
        section_key: 'reading',
        title: 'Reading',
        sort_order: 1,
        duration_seconds: 1200,
        weight_percent: 50,
        blocks: [
          {
            title: 'Part 1',
            sort_order: 0,
            slots: [
              {
                sort_order: 0,
                slot_kind: 'rule',
                rule: {
                  select_count: 5,
                  difficulty_min: 1,
                  difficulty_max: 4,
                  exclude_recent_days: 30,
                  deny_duplicate_media: true,
                  allow_reuse_if_pool_short: true,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

export default function ExamContentExams() {
  const [versions, setVersions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [versionCode, setVersionCode] = useState('hsk_2_0');
  const [levelId, setLevelId] = useState('');
  const [blueprints, setBlueprints] = useState([]);
  const [name, setName] = useState('HSK Mock');
  const [editionId, setEditionId] = useState('');
  const [structure, setStructure] = useState(defaultStructure);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

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

  const reloadBlueprints = async () => {
    if (!levelId) return;
    const rows = await api.examContent.blueprints.list(levelId);
    setBlueprints(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    reloadBlueprints().catch((err) => setError(userFacingError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId]);

  const createBlueprint = async () => {
    setBusy(true);
    setError('');
    try {
      const bp = await api.examContent.blueprints.create({
        level_id: levelId,
        name,
      });
      const editions = bp.editions || [];
      const draft = editions[0];
      if (draft?.id) {
        setEditionId(draft.id);
        await api.examContent.editions.saveStructure(draft.id, structure);
      }
      setOk('Blueprint и draft edition созданы');
      await reloadBlueprints();
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  const openEdition = async (id) => {
    setEditionId(id);
    setError('');
    try {
      const data = await api.examContent.editions.structure(id);
      const sections = (data.sections || []).map((s, si) => ({
        section_key: s.sectionKey || s.section_key,
        title: s.title,
        sort_order: s.sortOrder ?? s.sort_order ?? si,
        duration_seconds: s.durationSeconds ?? s.duration_seconds,
        weight_percent: Number(s.weightPercent ?? s.weight_percent ?? 0),
        blocks: (s.blocks || []).map((b, bi) => ({
          title: b.title,
          sort_order: b.sortOrder ?? b.sort_order ?? bi,
          duration_seconds: b.durationSeconds ?? b.duration_seconds,
          slots: (b.slots || []).map((sl, sli) => ({
            sort_order: sl.sortOrder ?? sl.sort_order ?? sli,
            slot_kind: sl.slotKind || sl.slot_kind || 'rule',
            fixed_group_id: sl.fixedGroupId || sl.fixed_group_id,
            fixed_item_id: sl.fixedItemId || sl.fixed_item_id,
            rule: sl.selectionRule || sl.selection_rule
              ? {
                  select_count:
                    sl.selectionRule?.selectCount ?? sl.selection_rule?.select_count ?? 1,
                  difficulty_min:
                    sl.selectionRule?.difficultyMin ?? sl.selection_rule?.difficulty_min ?? 1,
                  difficulty_max:
                    sl.selectionRule?.difficultyMax ?? sl.selection_rule?.difficulty_max ?? 5,
                  exclude_recent_days:
                    sl.selectionRule?.excludeRecentDays ??
                    sl.selection_rule?.exclude_recent_days ??
                    30,
                  deny_duplicate_media:
                    sl.selectionRule?.denyDuplicateMedia ??
                    sl.selection_rule?.deny_duplicate_media ??
                    true,
                  allow_reuse_if_pool_short:
                    sl.selectionRule?.allowReuseIfPoolShort ??
                    sl.selection_rule?.allow_reuse_if_pool_short ??
                    false,
                  max_topic_share_percent: sl.selectionRule?.maxTopicSharePercent
                    ? Number(sl.selectionRule.maxTopicSharePercent)
                    : null,
                  item_type_codes: (sl.selectionRule?.typeFilters || []).map(
                    (t) => t.itemTypeCode || t.item_type_code,
                  ),
                }
              : undefined,
          })),
        })),
      }));
      setStructure({
        total_duration_seconds:
          data.edition?.totalDurationSeconds ?? data.edition?.total_duration_seconds ?? 0,
        sections,
      });
      const hist = await api.examContent.editions.history(id);
      setHistory(Array.isArray(hist) ? hist : []);
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const save = async () => {
    if (!editionId) return;
    setBusy(true);
    setError('');
    try {
      await api.examContent.editions.saveStructure(editionId, structure);
      setOk('Структура сохранена');
      await openEdition(editionId);
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  const moveSection = (index, dir) => {
    const next = [...structure.sections];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setStructure({
      ...structure,
      sections: next.map((s, i) => ({ ...s, sort_order: i })),
    });
  };

  return (
    <ExamContentShell active="exams">
      <p className="text-sm text-muted-foreground">
        Визуальный конструктор edition: Section → Block → Group/Rules. Published edition неизменяема;
        правки — через clone.
      </p>

      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Версия</span>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2"
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
              className="w-full h-9 rounded-md border border-input bg-background px-2"
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
            >
              {levels.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1 md:col-span-2">
            <span className="text-muted-foreground">Название экзамена</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <Button type="button" disabled={busy || !levelId} onClick={createBlueprint}>
          Создать blueprint + draft
        </Button>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <h2 className="font-medium">Blueprints</h2>
        <ul className="divide-y divide-border">
          {blueprints.map((bp) => (
            <li key={bp.id} className="py-3 space-y-2">
              <div className="font-medium">{bp.name}</div>
              <div className="flex flex-wrap gap-2">
                {(bp.editions || []).map((ed) => (
                  <Button
                    key={ed.id}
                    size="sm"
                    variant={editionId === ed.id ? 'default' : 'outline'}
                    onClick={() => openEdition(ed.id)}
                  >
                    {ed.title || `v${ed.revision}`} · {ed.status}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {editionId ? (
        <div className="rounded-lg border border-border p-4 space-y-4 bg-card">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <h2 className="font-medium">Структура edition</h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={save}>
                Сохранить
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  api.examContent.editions
                    .submitReview(editionId)
                    .then(() => openEdition(editionId))
                    .catch((e) => setError(userFacingError(e)))
                }
              >
                На проверку
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  api.examContent.editions
                    .publish(editionId)
                    .then(() => openEdition(editionId))
                    .catch((e) => setError(userFacingError(e)))
                }
              >
                Опубликовать
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  api.examContent.editions
                    .clone(editionId)
                    .then((data) => {
                      const id = data.edition?.id;
                      if (id) openEdition(id);
                      setOk('Создана новая draft-редакция');
                      return reloadBlueprints();
                    })
                    .catch((e) => setError(userFacingError(e)))
                }
              >
                Новая редакция (clone)
              </Button>
            </div>
          </div>

          <label className="text-sm space-y-1 block max-w-xs">
            <span className="text-muted-foreground">Длительность (сек)</span>
            <Input
              type="number"
              value={structure.total_duration_seconds}
              onChange={(e) =>
                setStructure({
                  ...structure,
                  total_duration_seconds: Number(e.target.value) || 0,
                })
              }
            />
          </label>

          <div className="space-y-3">
            {structure.sections.map((sec, idx) => (
              <div key={`${sec.section_key}-${idx}`} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <div>
                    <div className="font-medium">{sec.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {sec.section_key} · блоков: {(sec.blocks || []).length}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => moveSection(idx, -1)}>
                      ↑
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => moveSection(idx, 1)}>
                      ↓
                    </Button>
                  </div>
                </div>
                {(sec.blocks || []).map((b, bi) => (
                  <div key={bi} className="pl-3 border-l-2 border-muted space-y-1">
                    <div className="text-sm font-medium">{b.title}</div>
                    {(b.slots || []).map((sl, si) => (
                      <div key={si} className="text-xs text-muted-foreground">
                        Slot {si + 1}: {sl.slot_kind}
                        {sl.rule
                          ? ` · select ${sl.rule.select_count} · diff ${sl.rule.difficulty_min}-${sl.rule.difficulty_max}`
                          : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {history.length ? (
            <div>
              <h3 className="text-sm font-medium mb-1">История edition</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                {history.map((h) => (
                  <li key={h.id}>
                    {h.createdAt || h.created_at}: {h.action} — {h.summary || '—'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-muted-foreground">{ok}</p> : null}
      {/* silence unused */}
      <span className="hidden">{versionId}</span>
    </ExamContentShell>
  );
}
