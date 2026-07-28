/**
 * Jitsi External API helpers and lesson video UX utilities.
 * Keep free of Vite path aliases so Node unit tests can import this file.
 */

/** CRM page that embeds the lesson video provider (Jitsi, etc.). */
export function lessonVideoPath(lessonId) {
  if (!lessonId) return null;
  return `/lesson/${encodeURIComponent(lessonId)}/video`;
}

export function isOnlineLesson(lesson) {
  const format = lesson?.lesson_format ?? lesson?.lessonFormat;
  return format === 'online' || (!format && Boolean(lesson?.video_room_url || lesson?.meeting_link));
}

export function canStartVideoLesson(lesson, now = new Date()) {
  if (!lesson || !isOnlineLesson(lesson)) return { ok: false, reason: 'not_online' };
  const date = String(lesson.date || '').slice(0, 10);
  const time = String(lesson.start_time || lesson.startTime || '00:00').slice(0, 5);
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (!y || !m || !d) return { ok: false, reason: 'bad_date' };
  const start = new Date(y, m - 1, d, hh || 0, mm || 0);
  const duration = Number(lesson.duration || 60);
  const end = new Date(start.getTime() + duration * 60_000);
  const t = now.getTime();
  const joinFrom = start.getTime() - 10 * 60_000;
  const joinUntil = end.getTime() + 30 * 60_000;
  if (t < joinFrom) return { ok: false, reason: 'too_early', start };
  if (t > joinUntil) return { ok: true, reason: 'after', start, end };
  return { ok: true, reason: 'during', start, end };
}

export function lessonScheduleFallback(role) {
  if (role === 'student') return '/StudentLessons';
  if (role === 'teacher') return '/TeacherSchedule';
  return '/Dashboard';
}

export function parseJitsiDomain(roomUrl, fallback = 'meet.example.local') {
  if (!roomUrl) return fallback;
  try {
    return new URL(roomUrl).hostname || fallback;
  } catch {
    return fallback;
  }
}

/** Toolbar buttons kept for Longhua lessons (Russian UX — no invite/recording chrome). */
export const JITSI_TOOLBAR_BUTTONS = [
  'microphone',
  'camera',
  'desktop',
  'chat',
  'fullscreen',
  'hangup',
  'settings',
  'tileview',
  'select-background',
  'videoquality',
];

export function buildJitsiConfigOverwrite(options = {}) {
  const subject = options.subject || null;
  const config = {
    defaultLanguage: 'ru',
    disableDeepLinking: true,
    deeplinking: { disabled: true },
    prejoinConfig: { enabled: false },
    prejoinPageEnabled: false,
    enableWelcomePage: false,
    enableClosePage: false,
    requireDisplayName: false,
    disableInviteFunctions: true,
    enableInsecureRoomNameWarning: false,
    hideConferenceSubject: false,
    enableLobby: false,
    lobby: { autoKnock: false },
    notifications: [],
    toolbarButtons: JITSI_TOOLBAR_BUTTONS,
    buttonsWithNotifyClick: [],
    // Guest join: no auth UI — identity comes from CRM via userInfo / JWT.
    disableProfile: true,
    startWithAudioMuted: false,
    startWithVideoMuted: false,
  };
  if (subject) {
    config.subject = subject;
  }
  return config;
}

export function buildJitsiInterfaceConfigOverwrite() {
  return {
    APP_NAME: 'Longhua',
    NATIVE_APP_NAME: 'Longhua',
    PROVIDER_NAME: 'Longhua',
    DEFAULT_LANGUAGE: 'ru',
    LANG_DETECTION: false,
    SHOW_JITSI_WATERMARK: false,
    SHOW_WATERMARK_FOR_GUESTS: false,
    SHOW_BRAND_WATERMARK: false,
    SHOW_POWERED_BY: false,
    SHOW_CHROME_EXTENSION_BANNER: false,
    MOBILE_APP_PROMO: false,
    DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
    DISABLE_PRESENCE_STATUS: true,
    DEFAULT_REMOTE_DISPLAY_NAME: 'Участник',
    DEFAULT_LOCAL_DISPLAY_NAME: 'Я',
    TOOLBAR_BUTTONS: JITSI_TOOLBAR_BUTTONS,
    SETTINGS_SECTIONS: ['devices', 'language'],
    HIDE_INVITE_MORE_HEADER: true,
  };
}

/**
 * Load JitsiMeetExternalAPI from the provider host (once per domain).
 * @returns {Promise<typeof window.JitsiMeetExternalAPI>}
 */
export function loadJitsiExternalApi(domain, scriptUrl) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Jitsi доступен только в браузере'));
  }
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve(window.JitsiMeetExternalAPI);
  }

  const src = scriptUrl || `https://${domain}/external_api.js`;
  const existing = document.querySelector(`script[data-jitsi-external-api="1"][src="${src}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.JitsiMeetExternalAPI));
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить видео')));
      if (window.JitsiMeetExternalAPI) resolve(window.JitsiMeetExternalAPI);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.jitsiExternalApi = '1';
    script.onload = () => {
      if (window.JitsiMeetExternalAPI) resolve(window.JitsiMeetExternalAPI);
      else reject(new Error('Видеосервис не ответил'));
    };
    script.onerror = () => reject(new Error('Не удалось загрузить видеосервис'));
    document.body.appendChild(script);
  });
}

export const JITSI_IFRAME_ALLOW =
  'camera; microphone; display-capture; fullscreen; autoplay; clipboard-write; hid';

/**
 * Ensure the iframe created by External API has the permissions browsers require.
 */
export function hardenJitsiIframe(api) {
  try {
    const iframe = api?.getIFrame?.();
    if (!iframe) return;
    iframe.setAttribute('allow', JITSI_IFRAME_ALLOW);
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('title', 'Онлайн-урок');
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
  } catch {
    // ignore — provider may not expose getIFrame yet
  }
}

/**
 * Probe camera / mic / network before join. Must run after a user gesture when possible.
 */
export async function checkMediaDevices() {
  const result = {
    camera: { ok: false, label: 'Камера' },
    microphone: { ok: false, label: 'Микрофон' },
    network: { ok: typeof navigator !== 'undefined' && navigator.onLine !== false, label: 'Интернет' },
  };

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return result;
  }

  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const hasVideo = stream.getVideoTracks().some((t) => t.readyState === 'live');
    const hasAudio = stream.getAudioTracks().some((t) => t.readyState === 'live');
    result.camera.ok = hasVideo;
    result.microphone.ok = hasAudio;
  } catch {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      result.microphone.ok = stream.getAudioTracks().some((t) => t.readyState === 'live');
    } catch {
      result.microphone.ok = false;
    }
    try {
      const v = await navigator.mediaDevices.getUserMedia({ video: true });
      result.camera.ok = v.getVideoTracks().some((t) => t.readyState === 'live');
      v.getTracks().forEach((t) => t.stop());
    } catch {
      result.camera.ok = false;
    }
  } finally {
    stream?.getTracks?.().forEach((t) => t.stop());
  }

  result.network.ok = navigator.onLine !== false;
  return result;
}
