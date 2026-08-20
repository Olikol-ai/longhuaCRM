/**
 * Helpers for weekly lesson series scope prompts (cancel / edit / delete).
 */

export function lessonBelongsToSeries(lesson) {
  return Boolean(
    lesson?.recurrence_series_id ||
      lesson?.recurrenceSeriesId ||
      lesson?.is_recurring ||
      lesson?.isRecurring,
  );
}

/** Status-change UX: this vs full series (`all`). */
export const STATUS_SCOPE_OPTIONS = [
  {
    value: "this",
    title: "Только это занятие",
    description: "Изменение коснётся только выбранного урока",
  },
  {
    value: "all",
    title: "Все занятия серии",
    description: "Изменятся все запланированные уроки этой серии",
  },
];

/** Delete UX: this vs full series (`all`). */
export const DELETE_SCOPE_OPTIONS = [
  {
    value: "this",
    title: "Только это занятие",
    description: "Будет удалено только выбранное занятие",
  },
  {
    value: "all",
    title: "Все занятия серии",
    description: "Будут удалены все занятия этой серии",
  },
];

export function statusChangeDialogTitle(status) {
  if (status === "cancelled") return "Отменить:";
  if (status === "completed") return "Отметить проведённым:";
  if (status === "missed" || status === "missed_no_notice") {
    return "Изменить статус:";
  }
  return "Изменить статус:";
}

export function statusChangeToastTitle(status, applyScope) {
  const series = applyScope === "all" || applyScope === "series";
  if (status === "cancelled") {
    return series ? "Занятия серии отменены" : "Урок отменён";
  }
  if (status === "completed") {
    return series
      ? "Занятия серии отмечены как проведённые"
      : "Занятие отмечено как проведённое";
  }
  return series ? "Статус занятий серии обновлён" : "Статус занятия обновлён";
}

export function deleteToastTitle(applyScope) {
  const series = applyScope === "all" || applyScope === "series";
  return series ? "Серия занятий удалена" : "Урок удалён";
}

export function isSeriesWideScope(applyScope) {
  return applyScope === "all" || applyScope === "series";
}
