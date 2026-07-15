/** Full 24-hour day labels for calendar grids (0–23). */
export const DAY_HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Half-hour options for select pickers (00:00–23:30). */
export const TIME_OPTIONS = DAY_HOURS.flatMap((hour) => {
  const label = String(hour).padStart(2, "0");
  return [`${label}:00`, `${label}:30`];
});

/** Display helper: `10:00:00` / `9:05` → `10:00` / `09:05`. */
export function formatTime(value) {
  if (value == null || value === "") return "";
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!match) return String(value);
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}
