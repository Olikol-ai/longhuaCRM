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

/**
 * Delete UX:
 * - this — only the selected occurrence
 * - future — selected + later planned of THIS recurrence series (stops series)
 * - series — all planned of the series (stops series, keeps history)
 */
export const DELETE_SCOPE_OPTIONS = [
  {
    value: "this",
    title: "Только это занятие",
    description: "Будет удалено только выбранное занятие",
  },
  {
    value: "future",
    title: "Это и все последующие",
    description:
      "Будут удалены это и все будущие занятия этой серии. Повторение будет остановлено.",
  },
  {
    value: "series",
    title: "Удалить всю серию",
    description:
      "Будут удалены все будущие занятия этой серии. Проведённые занятия останутся.",
  },
];

/** Options when the lesson is not part of a recurrence series. */
export const DELETE_SCOPE_OPTIONS_ONE_OFF = [
  {
    value: "this",
    title: "Только это занятие",
    description: "Будет удалено только выбранное занятие",
  },
  {
    value: "future",
    title: "Это и все последующие",
    description:
      "Будут удалены это и все будущие назначенные занятия этого ученика",
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

export function deleteToastTitle(applyScope, deletedCount) {
  if (applyScope === "future" || applyScope === "series") {
    if (typeof deletedCount === "number" && deletedCount > 1) {
      return `Удалено занятий: ${deletedCount}`;
    }
    return applyScope === "series" ? "Серия занятий удалена" : "Урок удалён";
  }
  const series = applyScope === "all";
  return series ? "Серия занятий удалена" : "Урок удалён";
}

export function isSeriesWideScope(applyScope) {
  return applyScope === "all" || applyScope === "series";
}

export function isFutureDeleteScope(applyScope) {
  return applyScope === "future";
}

/** Format YYYY-MM-DD → DD.MM.YYYY for delete confirmations. */
export function formatLessonDeleteDate(isoDate) {
  const raw = String(isoDate || "").slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw || "—";
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function formatLessonDeleteDateTime(isoDate, startTime) {
  const datePart = formatLessonDeleteDate(isoDate);
  const time = String(startTime || "").slice(0, 5);
  return time ? `${datePart} ${time}` : datePart;
}

export function futureDeleteWarningText(preview, mode = "future") {
  if (!preview || (preview.count == null && preview.deletedCount == null)) {
    return null;
  }
  const count = preview.count ?? preview.deletedCount;
  const fromDate = preview.fromDate ?? preview.from_date;
  if (count == null) return null;
  const from = formatLessonDeleteDate(fromDate);
  if (mode === "series") {
    return `Будут удалены все будущие занятия этой серии (${count}), включая отменённые слоты. Проведённые и пропущенные занятия останутся. Повторение серии будет остановлено.`;
  }
  return `Будет удалено ${count} занятий этой серии, начиная с ${from} (включая отменённые слоты). Проведённые занятия останутся. Повторение серии будет остановлено. Другие серии ученика не затрагиваются.`;
}

export function thisDeleteWarningText(lesson) {
  if (!lesson) return "Удалить выбранное занятие?";
  const when = formatLessonDeleteDateTime(lesson.date, lesson.start_time || lesson.startTime);
  return `Удалить занятие ${when}?`;
}
