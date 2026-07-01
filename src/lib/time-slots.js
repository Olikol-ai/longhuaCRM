/** Full 24-hour day labels for calendar grids (0–23). */
export const DAY_HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Half-hour options for select pickers (00:00–23:30). */
export const TIME_OPTIONS = DAY_HOURS.flatMap((hour) => {
  const label = String(hour).padStart(2, "0");
  return [`${label}:00`, `${label}:30`];
});
