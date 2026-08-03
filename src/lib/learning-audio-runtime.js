/**
 * Runtime coordination for learning-content audio (AuthenticatedAudio).
 * Ensures at most one CRM audio element plays at a time and supports
 * explicit stop on navigation / unmount.
 */

let activeElement = null;

function isCrmAudioElement(el) {
  return Boolean(el && el.classList?.contains('crm-audio-player__element'));
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

/** Pause every mounted CRM learning audio player. */
export function stopAllLearningAudio() {
  if (typeof document !== 'undefined') {
    document.querySelectorAll('audio.crm-audio-player__element').forEach((node) => {
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
  return isCrmAudioElement(el) && activeElement === el;
}
