/** Pedagogical labels for Exam Content Studio (UI only — API names stay English). */

export const CONTENT_STATUS_LABEL = {
  draft: 'Черновик',
  /** Legacy status — no review workflow; shown as draft. */
  in_review: 'Черновик',
  published: 'Опубликовано',
  archived: 'В архиве',
};

export function contentStatusLabel(status) {
  if (!status) return '—';
  return CONTENT_STATUS_LABEL[status] || String(status);
}

export const ITEM_TYPE_LABEL = {
  single_choice: 'Один ответ',
  multiple_choice: 'Несколько ответов',
  short_text: 'Короткий ответ',
  matching: 'Соответствие',
  ordering: 'Порядок',
  listening: 'Аудирование',
  reading: 'Чтение',
  writing: 'Письмо',
};

export function itemTypeLabel(code) {
  if (!code) return '—';
  return ITEM_TYPE_LABEL[code] || String(code);
}

export const CHANGE_ACTION_LABEL = {
  create: 'Создание',
  update: 'Изменение',
  status_change: 'Смена статуса',
  rollback: 'Новая версия',
  publish: 'Публикация',
  archive: 'Архивация',
};

export function changeActionLabel(action) {
  if (!action) return '—';
  return CHANGE_ACTION_LABEL[action] || String(action);
}

/** Human-readable history line (hides internal clone/revision jargon). */
export function formatChangeSummary(entry) {
  const action = entry?.action;
  const summary = String(entry?.summary || '');
  if (action === 'rollback' || /cloned|new revision|rollback/i.test(summary)) {
    return 'Создана новая версия для редактирования';
  }
  if (action === 'create') return 'Задание создано';
  if (action === 'update') return 'Черновик обновлён';
  if (action === 'status_change') {
    const m = summary.match(/(\w+)\s*→\s*(\w+)/);
    if (m) {
      return `${contentStatusLabel(m[1])} → ${contentStatusLabel(m[2])}`;
    }
  }
  if (!summary || /Updated item draft|Engine|uuid/i.test(summary)) {
    return changeActionLabel(action);
  }
  return summary;
}

export function formatItemStatsMessage(stats) {
  if (!stats) return '';
  const answers = stats.timesAnswered ?? stats.times_answered ?? 0;
  const difficulty = stats.difficultyIndex ?? stats.difficulty_index;
  const discrimination = stats.discriminationIndex ?? stats.discrimination_index;
  const parts = [`ответов учеников: ${answers}`];
  if (difficulty != null && difficulty !== '') {
    parts.push(`сложность по результатам: ${difficulty}`);
  }
  if (discrimination != null && discrimination !== '') {
    parts.push(`различительная способность: ${discrimination}`);
  }
  return `Статистика: ${parts.join(', ')}`;
}

export const DIFFICULTY_BUCKETS = [
  { id: 'easy', label: 'Лёгкие', min: 1, max: 2 },
  { id: 'mid', label: 'Средние', min: 3, max: 4 },
  { id: 'hard', label: 'Сложные', min: 5, max: 5 },
];

export function difficultyLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n <= 2) return 'Лёгкий';
  if (n <= 4) return 'Средний';
  return 'Сложный';
}

export function secondsToMinutes(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return 0;
  return Math.max(1, Math.round(s / 60));
}

export function minutesToSeconds(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return 0;
  return Math.round(m) * 60;
}

export function formatMinutesLabel(minutes) {
  const m = Number(minutes) || 0;
  return `${m} мин`;
}

export const MEDIA_KIND_LABEL = {
  audio: 'Аудио',
  image: 'Изображение',
  video: 'Видео',
  pdf: 'PDF',
};

/** Build structure payload (API seconds) from wizard section state (minutes). */
export function buildStructureFromWizardSections(sections) {
  const enabled = (sections || []).filter((s) => s.enabled);
  const totalMinutes = enabled.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  return {
    total_duration_seconds: minutesToSeconds(totalMinutes),
    sections: enabled.map((s, si) => {
      const slots = [];
      let sort = 0;
      if (s.fillMode === 'manual' && Array.isArray(s.itemIds) && s.itemIds.length) {
        for (const itemId of s.itemIds) {
          slots.push({
            sort_order: sort++,
            slot_kind: 'fixed_item',
            fixed_item_id: itemId,
          });
        }
      } else {
        const easy = Number(s.easyCount) || 0;
        const mid = Number(s.midCount) || 0;
        const hard = Number(s.hardCount) || 0;
        if (easy > 0) {
          slots.push({
            sort_order: sort++,
            slot_kind: 'rule',
            rule: {
              select_count: easy,
              difficulty_min: 1,
              difficulty_max: 2,
              exclude_recent_days: 14,
              deny_duplicate_media: true,
              allow_reuse_if_pool_short: true,
              item_type_codes: ['single_choice'],
            },
          });
        }
        if (mid > 0) {
          slots.push({
            sort_order: sort++,
            slot_kind: 'rule',
            rule: {
              select_count: mid,
              difficulty_min: 3,
              difficulty_max: 4,
              exclude_recent_days: 14,
              deny_duplicate_media: true,
              allow_reuse_if_pool_short: true,
              item_type_codes: ['single_choice'],
            },
          });
        }
        if (hard > 0) {
          slots.push({
            sort_order: sort++,
            slot_kind: 'rule',
            rule: {
              select_count: hard,
              difficulty_min: 5,
              difficulty_max: 5,
              exclude_recent_days: 14,
              deny_duplicate_media: true,
              allow_reuse_if_pool_short: true,
              item_type_codes: ['single_choice'],
            },
          });
        }
        if (!slots.length) {
          slots.push({
            sort_order: 0,
            slot_kind: 'rule',
            rule: {
              select_count: 5,
              difficulty_min: 1,
              difficulty_max: 4,
              exclude_recent_days: 14,
              deny_duplicate_media: true,
              allow_reuse_if_pool_short: true,
              item_type_codes: ['single_choice'],
            },
          });
        }
      }
      return {
        section_key: s.sectionKey,
        title: s.title,
        sort_order: si,
        duration_seconds: minutesToSeconds(s.minutes),
        weight_percent: Math.round(100 / Math.max(1, enabled.length)),
        blocks: [
          {
            title: s.title,
            sort_order: 0,
            slots,
          },
        ],
      };
    }),
  };
}

/** Parse API structure into wizard section rows. */
export function wizardSectionsFromStructure(structure, taxonomySections = []) {
  const byKey = new Map(
    (taxonomySections || []).map((s) => [s.sectionKey || s.section_key, s]),
  );
  const fromApi = structure?.sections || [];
  const keys = new Set([
    ...[...byKey.keys()],
    ...fromApi.map((s) => s.section_key || s.sectionKey),
  ]);

  return [...keys].filter(Boolean).map((key) => {
    const tax = byKey.get(key);
    const row = fromApi.find((s) => (s.section_key || s.sectionKey) === key);
    const title = row?.title || tax?.title || key;
    const minutes = row
      ? secondsToMinutes(row.duration_seconds ?? row.durationSeconds)
      : 15;
    const slots = (row?.blocks || []).flatMap((b) => b.slots || []);
    const fixedIds = slots
      .filter((sl) => (sl.slot_kind || sl.slotKind) === 'fixed_item')
      .map((sl) => sl.fixed_item_id || sl.fixedItemId)
      .filter(Boolean);
    let easyCount = 0;
    let midCount = 0;
    let hardCount = 0;
    for (const sl of slots) {
      const rule = sl.rule || sl.selectionRule;
      if (!rule) continue;
      const count = rule.select_count ?? rule.selectCount ?? 0;
      const dMin = rule.difficulty_min ?? rule.difficultyMin ?? 1;
      const dMax = rule.difficulty_max ?? rule.difficultyMax ?? 5;
      if (dMax <= 2) easyCount += count;
      else if (dMin >= 5) hardCount += count;
      else midCount += count;
    }
    return {
      sectionKey: key,
      title,
      enabled: Boolean(row),
      minutes: minutes || 15,
      fillMode: fixedIds.length ? 'manual' : 'auto',
      easyCount: easyCount || (fixedIds.length ? 0 : 5),
      midCount: midCount || 0,
      hardCount: hardCount || 0,
      itemIds: fixedIds,
    };
  });
}
