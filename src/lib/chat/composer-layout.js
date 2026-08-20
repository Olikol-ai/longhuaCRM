/**
 * Pure helpers for ChatComposer autosize, keyboard inset, and voice gestures.
 */

export const COMPOSER_MODE = {
  IDLE: 'idle',
  TYPING: 'typing',
  RECORDING: 'recording',
  PREVIEW: 'preview',
  PICKER: 'picker',
};

export const VOICE_PHASE = {
  IDLE: 'idle',
  RECORDING: 'recording',
  CANCELLING: 'cancelling',
  LOCKED: 'locked',
  STOPPING: 'stopping',
  SENDING: 'sending',
  ERROR: 'error',
};

/** Swipe-left cancel threshold (px). */
export const VOICE_CANCEL_DX = 72;
/** Swipe-up lock threshold (px). */
export const VOICE_LOCK_DY = 64;
/** Ignore accidental micro-taps as sends (ms). */
export const VOICE_MIN_SEND_MS = 250;

export const VOICE_PHASES = Object.values(VOICE_PHASE);

/**
 * Whether locked-mode Send/Cancel must be independent buttons
 * (gesture window listeners must not own the pointer anymore).
 */
export function voiceButtonsInteractive(phase) {
  return phase === VOICE_PHASE.LOCKED || phase === VOICE_PHASE.SENDING || phase === VOICE_PHASE.STOPPING;
}

export function resolveComposerMode({
  body = '',
  recording = false,
  preview = null,
  tray = null,
}) {
  if (recording) return COMPOSER_MODE.RECORDING;
  if (preview) return COMPOSER_MODE.PREVIEW;
  if (tray) return COMPOSER_MODE.PICKER;
  if (String(body).trim().length > 0) return COMPOSER_MODE.TYPING;
  return COMPOSER_MODE.IDLE;
}

export function clampComposerFieldHeight(scrollHeight, {
  min = 44,
  max = 160,
} = {}) {
  const value = Number(scrollHeight) || 0;
  return Math.min(Math.max(value, min), max);
}

export function formatRecordingClock(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000) || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function voiceFileExtension(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('mp4') || mime.includes('aac') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

/**
 * Live keyboard gap: layout bottom → visual viewport bottom.
 * Prefer this over a frozen baseline so Android (layout already shrunk) does not
 * double-count and leave a gap above the keyboard.
 */
export function keyboardInsetPx(innerHeight, viewportHeight, offsetTop = 0) {
  const inset = Number(innerHeight) - Number(viewportHeight) - Number(offsetTop || 0);
  return Math.max(0, Math.round(inset));
}

/**
 * Resolve inset + baseline.
 * Prefer live inset (innerHeight − vv). When the layout viewport already shrunk
 * with the keyboard (Android Chrome), never fall back to a tall baseline — that
 * double-counts and leaves a visible gap above the keyboard.
 */
export function resolveKeyboardInset({
  baseline,
  innerHeight,
  viewportHeight,
  offsetTop = 0,
}) {
  const base = Number(baseline) || 0;
  const inner = Number(innerHeight) || 0;
  const vv = Number(viewportHeight) || 0;
  const top = Number(offsetTop || 0);
  const live = keyboardInsetPx(inner, vv, top);
  const fromBaseline = keyboardInsetPx(base, vv, top);
  const layoutShrunk = inner > 0 && base > 0 && inner < base * 0.92;
  const vvShrunk = vv > 0 && base > 0 && vv < base * 0.92;

  if (layoutShrunk) {
    return { inset: live, baseline: Math.max(base, inner) };
  }

  if (live > 24) {
    return { inset: live, baseline: Math.max(base, inner) };
  }

  // Layout still tall; vv clearly short but live≈0 (offsetTop quirks) → baseline.
  if (fromBaseline > 40 && vvShrunk) {
    return { inset: fromBaseline, baseline: base };
  }

  const nextBaseline = Math.max(base, inner, vv + top);
  return { inset: 0, baseline: nextBaseline };
}

/** @deprecated use resolveKeyboardInset — kept for call-site migration */
export function nextKeyboardBaseline(prevBaseline, innerHeight, viewportHeight, offsetTop = 0) {
  return resolveKeyboardInset({
    baseline: prevBaseline,
    innerHeight,
    viewportHeight,
    offsetTop,
  }).baseline;
}

/** Safe-area alone when keyboard closed; keyboard inset alone when open. */
export function composerBottomInset({ safeArea = 0, kbdInset = 0, floor = 0 } = {}) {
  if (kbdInset > 24) return Math.max(floor, kbdInset);
  return Math.max(floor, safeArea);
}

/**
 * Hold-to-record phase while finger is down (before lock sticks).
 * Left wins cancel; up wins lock. Once locked, stay locked.
 */
export function resolveVoiceHoldPhase({ dx = 0, dy = 0, locked = false } = {}) {
  if (locked) return VOICE_PHASE.LOCKED;
  const absX = Math.abs(Number(dx) || 0);
  const absY = Math.abs(Number(dy) || 0);
  if (Number(dx) <= -VOICE_CANCEL_DX && absX >= absY) return VOICE_PHASE.CANCELLING;
  if (Number(dy) <= -VOICE_LOCK_DY && absY >= absX) return VOICE_PHASE.LOCKED;
  return VOICE_PHASE.RECORDING;
}

/**
 * What to do on pointerup / pointercancel.
 * @returns {'cancel'|'send'|'keep'|'noop'}
 */
export function resolveVoicePointerUp({ phase, locked = false, durationMs = 0 } = {}) {
  if (phase === VOICE_PHASE.CANCELLING) return 'cancel';
  if (locked || phase === VOICE_PHASE.LOCKED) return 'keep';
  if (phase === VOICE_PHASE.RECORDING || phase === VOICE_PHASE.SENDING) {
    if (Number(durationMs) < VOICE_MIN_SEND_MS) return 'cancel';
    return 'send';
  }
  return 'noop';
}

export function vibrateBrief(pattern = 12) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}
