import { STALE_WARN_MS } from './constants.js';

/**
 * Human-readable “updated …” label (ru).
 * @param {number|null|undefined} updatedAt
 * @param {number} [now]
 */
export function formatOfflineUpdatedAt(updatedAt, now = Date.now()) {
  const ts = Number(updatedAt);
  if (!Number.isFinite(ts) || ts <= 0) return null;

  const diffMs = Math.max(0, now - ts);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Обновлено только что';
  if (mins < 60) return `Обновлено ${mins} мин назад`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Обновлено ${hours} ч назад`;

  try {
    const formatted = new Date(ts).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `Обновлено ${formatted}`;
  } catch {
    return 'Обновлено ранее';
  }
}

export function isOfflineDataStale(updatedAt, now = Date.now(), warnMs = STALE_WARN_MS) {
  const ts = Number(updatedAt);
  if (!Number.isFinite(ts) || ts <= 0) return true;
  return now - ts >= warnMs;
}

export function offlineStaleCaption(updatedAt, now = Date.now()) {
  const label = formatOfflineUpdatedAt(updatedAt, now);
  if (!label) return 'Данные могут быть устаревшими';
  if (isOfflineDataStale(updatedAt, now)) {
    return `${label} · Данные могут быть устаревшими`;
  }
  return label;
}
