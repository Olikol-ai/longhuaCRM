/**
 * Document Picture-in-Picture helpers (Chrome Desktop).
 * @see https://developer.chrome.com/docs/web-platform/document-picture-in-picture/
 */

export const DOCUMENT_PIP_DEFAULT_SIZE = Object.freeze({ width: 360, height: 240 });

/**
 * @param {Window | undefined | null} [win]
 * @returns {boolean}
 */
export function isDocumentPictureInPictureSupported(win = typeof window !== 'undefined' ? window : null) {
  return Boolean(win && 'documentPictureInPicture' in win);
}

/**
 * Copy stylesheets from the opener document into a Document PiP window.
 * One-time copy (Chrome docs pattern).
 * @param {Window} pipWindow
 * @param {Document} [sourceDoc]
 */
export function copyStylesToPictureInPictureWindow(pipWindow, sourceDoc = document) {
  if (!pipWindow?.document?.head || !sourceDoc) return;
  const head = pipWindow.document.head;
  for (const styleSheet of Array.from(sourceDoc.styleSheets)) {
    try {
      const cssRules = Array.from(styleSheet.cssRules)
        .map((rule) => rule.cssText)
        .join('');
      const style = sourceDoc.createElement('style');
      style.setAttribute('data-lh-pip-style', '1');
      style.textContent = cssRules;
      head.appendChild(style);
    } catch {
      if (styleSheet.href) {
        const link = sourceDoc.createElement('link');
        link.setAttribute('data-lh-pip-style', '1');
        link.rel = 'stylesheet';
        link.type = styleSheet.type || 'text/css';
        if (styleSheet.media?.mediaText) link.media = styleSheet.media.mediaText;
        link.href = styleSheet.href;
        head.appendChild(link);
      }
    }
  }

  const base = sourceDoc.createElement('style');
  base.setAttribute('data-lh-pip-base', '1');
  base.textContent = `
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #0a0a0a;
      color: #fafafa;
    }
    #lh-document-pip-root {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  `;
  head.appendChild(base);
}

/**
 * @param {{
 *   width?: number,
 *   height?: number,
 *   preferInitialWindowPlacement?: boolean,
 *   disallowReturnToOpener?: boolean,
 * }} [options]
 * @param {Window} [win]
 * @returns {Promise<Window>}
 */
export async function requestDocumentPictureInPictureWindow(options = {}, win = window) {
  if (!isDocumentPictureInPictureSupported(win)) {
    throw new Error('Document Picture-in-Picture is not supported');
  }
  const width = options.width ?? DOCUMENT_PIP_DEFAULT_SIZE.width;
  const height = options.height ?? DOCUMENT_PIP_DEFAULT_SIZE.height;
  return win.documentPictureInPicture.requestWindow({
    width,
    height,
    preferInitialWindowPlacement: options.preferInitialWindowPlacement !== false,
    disallowReturnToOpener: options.disallowReturnToOpener === true,
  });
}

/**
 * Move a DOM node into a target parent without React remounting the subtree.
 * Used to keep the Jitsi iframe alive across CRM ↔ Document PiP.
 * @param {HTMLElement | null | undefined} node
 * @param {HTMLElement | null | undefined} target
 * @returns {boolean} true when a move happened
 */
export function reparentDomNode(node, target) {
  if (!node || !target) return false;
  if (node.parentElement === target) return false;
  target.appendChild(node);
  return true;
}

/**
 * Register Media Session auto-PiP for video conferencing (progressive enhancement).
 * @param {() => void | Promise<void>} onEnter
 * @returns {() => void} cleanup
 */
export function registerAutomaticDocumentPiPHandler(onEnter) {
  if (typeof navigator === 'undefined' || !navigator.mediaSession?.setActionHandler) {
    return () => {};
  }
  try {
    navigator.mediaSession.setActionHandler('enterpictureinpicture', () => {
      void Promise.resolve(onEnter());
    });
  } catch {
    return () => {};
  }
  return () => {
    try {
      navigator.mediaSession.setActionHandler('enterpictureinpicture', null);
    } catch {
      // ignore
    }
  };
}

/**
 * Reflect mic/camera state for Chrome media controls / auto-PiP eligibility.
 * @param {{ microphoneActive?: boolean, cameraActive?: boolean }} state
 */
export function syncMediaSessionConferenceState(state = {}) {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
  try {
    if (typeof navigator.mediaSession.setMicrophoneActive === 'function'
      && typeof state.microphoneActive === 'boolean') {
      navigator.mediaSession.setMicrophoneActive(state.microphoneActive);
    }
    if (typeof navigator.mediaSession.setCameraActive === 'function'
      && typeof state.cameraActive === 'boolean') {
      navigator.mediaSession.setCameraActive(state.cameraActive);
    }
  } catch {
    // ignore unsupported environments
  }
}
