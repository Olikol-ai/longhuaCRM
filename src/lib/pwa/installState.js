/**
 * Install / standalone detection helpers (no React).
 */

export const PWA_INSTALL_DISMISS_KEY = 'lh_pwa_install_dismissed_at';
export const PWA_INSTALL_DISMISS_DAYS = 30;

export function isDisplayStandalone() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    if (window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches) return true;
  } catch {
    /* ignore */
  }
  // iOS Safari legacy
  return Boolean(window.navigator?.standalone);
}

export function isIosSafariLike() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit && notOther;
}

export function canUseBeforeInstallPrompt() {
  return typeof window !== 'undefined' && 'onbeforeinstallprompt' in window;
}

export function readInstallDismissedAt() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PWA_INSTALL_DISMISS_KEY);
    if (!raw) return null;
    const ts = Date.parse(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

export function isInstallPromptDismissed(now = Date.now()) {
  const at = readInstallDismissedAt();
  if (!at) return false;
  return now - at < PWA_INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function dismissInstallPrompt(now = Date.now()) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PWA_INSTALL_DISMISS_KEY, new Date(now).toISOString());
  } catch {
    /* ignore */
  }
}

export function clearInstallPromptDismiss() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(PWA_INSTALL_DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

/** Whether we should offer install UI (not already installed, not recently dismissed). */
export function shouldOfferInstallUi({
  standalone = isDisplayStandalone(),
  dismissed = isInstallPromptDismissed(),
} = {}) {
  if (standalone) return false;
  if (dismissed) return false;
  return true;
}
