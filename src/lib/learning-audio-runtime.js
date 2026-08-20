/**
 * Global exclusive audio playback — at most one Longhua audio engine at a time.
 * Used by learning content and chat voice (same engine class).
 */

const ENGINE_SELECTOR = 'audio.lh-audio-engine';

let activeElement = null;

function isEngine(el) {
  return Boolean(el && el.classList?.contains('lh-audio-engine'));
}

export function claimLearningAudio(el) {
  if (!el) return;
  if (activeElement && activeElement !== el) {
    try {
      if (!activeElement.paused) activeElement.pause();
    } catch {
      // ignore
    }
  }
  activeElement = el;
}

export function releaseLearningAudio(el) {
  if (activeElement === el) {
    activeElement = null;
  }
}

/** Pause every mounted Longhua audio engine. */
export function stopAllLearningAudio() {
  if (typeof document !== 'undefined') {
    document.querySelectorAll(ENGINE_SELECTOR).forEach((node) => {
      try {
        if (!node.paused) node.pause();
      } catch {
        // ignore
      }
    });
  } else if (activeElement && !activeElement.paused) {
    try {
      activeElement.pause();
    } catch {
      // ignore
    }
  }
  activeElement = null;
}

export function pauseLearningAudioElement(el) {
  if (!el) return;
  try {
    if (!el.paused) el.pause();
  } catch {
    // ignore
  }
  releaseLearningAudio(el);
}

/** Detach media resource so the browser can free buffers. */
export function disposeLearningAudioElement(el) {
  if (!el) return;
  pauseLearningAudioElement(el);
  try {
    el.removeAttribute('src');
    el.load();
  } catch {
    // ignore
  }
}

export function isActiveLearningAudio(el) {
  return isEngine(el) && activeElement === el;
}

/** @deprecated Alias — same as claimLearningAudio */
export const claimAudio = claimLearningAudio;
/** @deprecated Alias — same as stopAllLearningAudio */
export const stopAllAudio = stopAllLearningAudio;
