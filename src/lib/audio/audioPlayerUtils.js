/**
 * Shared helpers for LonghuaAudioPlayer (duration / waveform seed).
 */

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];
export const DEFAULT_PLAYBACK_SPEED = 1;
export const SEEK_NUDGE_SECONDS = 10;

export function formatAudioClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function isFiniteDuration(value) {
  return Number.isFinite(value) && value > 0 && value !== Infinity;
}

/** Deterministic decorative waveform bars from an id seed. */
export function barsFromId(id, count = 36) {
  let h = 2166136261;
  const seed = String(id || 'audio');
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bars = [];
  for (let i = 0; i < count; i += 1) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    bars.push(0.22 + ((h >>> 0) % 78) / 100);
  }
  return bars;
}

/**
 * Map client X on a track element to a 0..1 ratio.
 */
export function seekRatioFromClientX(trackEl, clientX) {
  if (!trackEl) return 0;
  const rect = trackEl.getBoundingClientRect();
  if (!rect.width) return 0;
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

export function clampSeekSeconds(seconds, duration) {
  const t = Number(seconds);
  if (!Number.isFinite(t) || t < 0) return 0;
  if (!isFiniteDuration(duration)) return t;
  return Math.min(duration, t);
}

export function previewSeekRatio(ratio, duration) {
  const r = Math.min(1, Math.max(0, Number(ratio) || 0));
  const seconds = isFiniteDuration(duration) ? r * duration : 0;
  return { ratio: r, seconds };
}

/**
 * Commit a seek onto an HTMLMediaElement-like object.
 * If metadata/duration is not ready, returns pending seconds without touching currentTime.
 */
export function commitSeekToMedia(media, seconds) {
  if (!media) {
    return { applied: false, pending: clampSeekSeconds(seconds, NaN), currentTime: 0 };
  }
  const duration = Number(media.duration);
  const next = clampSeekSeconds(seconds, duration);
  const canSeek = Number(media.readyState) >= 1 && isFiniteDuration(duration);
  if (!canSeek) {
    return {
      applied: false,
      pending: next,
      currentTime: Number(media.currentTime) || 0,
    };
  }
  media.currentTime = next;
  return {
    applied: true,
    pending: null,
    currentTime: media.currentTime,
  };
}

export function playbackPosition(media) {
  return Number(media?.currentTime) || 0;
}
