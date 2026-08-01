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

/** Native Jitsi toolbar hidden — CRM shell owns mic/cam/screen/hangup. */
export const JITSI_TOOLBAR_BUTTONS = [];

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
    hideConferenceSubject: true,
    enableLobby: false,
    lobby: { autoKnock: false },
    notifications: [],
    toolbarButtons: [],
    buttonsWithNotifyClick: [],
    disableProfile: true,
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    hideConferenceTimer: false,
    disableModeratorIndicator: false,
    remoteVideoMenu: {
      disableKick: true,
      disableGrantModerator: true,
    },
    filmstrip: {
      disableResizable: true,
    },
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
    TOOLBAR_BUTTONS: [],
    SETTINGS_SECTIONS: ['devices', 'language'],
    HIDE_INVITE_MORE_HEADER: true,
    DISABLE_FOCUS_INDICATOR: true,
    FILM_STRIP_MAX_HEIGHT: 90,
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
    iframe.style.display = 'block';
    iframe.style.background = '#000';
  } catch {
    // ignore — provider may not expose getIFrame yet
  }
}

/** Ask External API / iframe to reflow after viewport or orientation changes. */
export function resizeJitsiEmbed(api, container) {
  hardenJitsiIframe(api);
  try {
    const iframe = api?.getIFrame?.();
    if (iframe && container) {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        iframe.style.width = `${Math.floor(rect.width)}px`;
        iframe.style.height = `${Math.floor(rect.height)}px`;
      }
    }
  } catch {
    // ignore
  }
}

/** Connection status labels for the lesson video shell. */
export const VIDEO_CONNECTION_STATUS = {
  idle: { id: 'idle', label: 'Ожидание', tone: 'muted' },
  connecting: { id: 'connecting', label: 'Подключение…', tone: 'warn' },
  connected: { id: 'connected', label: 'Подключено', tone: 'ok' },
  reconnecting: { id: 'reconnecting', label: 'Переподключение…', tone: 'warn' },
  degraded: { id: 'degraded', label: 'Проблемы соединения', tone: 'warn' },
  failed: { id: 'failed', label: 'Нет соединения', tone: 'bad' },
};

export function videoConnectionMeta(status) {
  return VIDEO_CONNECTION_STATUS[status] || VIDEO_CONNECTION_STATUS.idle;
}

/** Min time in conference before suggesting attendance status «Был». */
export const ATTENDANCE_SUGGEST_MS = 5 * 60 * 1000;

/** Strip role suffix like « (ученик)» and normalize for name matching. */
export function normalizeVideoDisplayName(name) {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function preferOnlinePresence(rows) {
  if (!rows.length) return null;
  const online = rows.filter((p) => p.online);
  if (online.length) return online[online.length - 1];
  return rows[rows.length - 1];
}

function rosterLookupFields(rosterOrName) {
  if (rosterOrName == null) {
    return { userId: '', email: '', name: '' };
  }
  if (typeof rosterOrName === 'string') {
    return { userId: '', email: '', name: rosterOrName };
  }
  return {
    userId: String(rosterOrName.user_id || rosterOrName.userId || '').trim(),
    email: String(rosterOrName.email || '')
      .trim()
      .toLowerCase(),
    name: String(rosterOrName.name || '').trim(),
  };
}

/**
 * Collapse reconnect duplicates: same CRM user / email / display name
 * must stay one presence row (status flips offline → online).
 */
export function coalesceLivePresence(liveList) {
  if (!Array.isArray(liveList) || liveList.length === 0) return [];
  const byKey = new Map();

  for (const row of liveList) {
    if (!row?.id) continue;
    const crmUserId = String(row.crmUserId || row.userId || row.user_id || '').trim();
    const email = String(row.email || '')
      .trim()
      .toLowerCase();
    const nameKey = normalizeVideoDisplayName(row.displayName || row.display_name);
    const preferredKey = crmUserId
      ? `user:${crmUserId}`
      : email
        ? `email:${email}`
        : nameKey
          ? `name:${nameKey}`
          : `id:${row.id}`;

    let existingKey = null;
    let existing = null;
    for (const [key, value] of byKey.entries()) {
      if (crmUserId && value.crmUserId && value.crmUserId === crmUserId) {
        existingKey = key;
        existing = value;
        break;
      }
      if (email && value.email && value.email === email) {
        existingKey = key;
        existing = value;
        break;
      }
      if (
        nameKey &&
        normalizeVideoDisplayName(value.displayName || value.display_name) === nameKey
      ) {
        existingKey = key;
        existing = value;
        break;
      }
    }

    if (!existing) {
      byKey.set(preferredKey, {
        ...row,
        crmUserId: crmUserId || null,
        email: email || null,
        jitsiIds: [row.id],
      });
      continue;
    }

    const preferIncoming = Boolean(row.online) && !existing.online;
    const primary = preferIncoming ? row : existing;
    const secondary = preferIncoming ? existing : row;
    const joinedCandidates = [existing.joinedAt, row.joinedAt, existing.joined_at, row.joined_at]
      .map((v) => (v == null ? null : Number(v)))
      .filter((v) => Number.isFinite(v));
    const accumulatedMs = Math.max(
      Number(existing.accumulatedMs || existing.accumulated_ms || 0),
      Number(row.accumulatedMs || row.accumulated_ms || 0),
    );

    if (existingKey && existingKey !== preferredKey) {
      byKey.delete(existingKey);
    }

    byKey.set(preferredKey, {
      ...primary,
      id: primary.online ? primary.id : secondary.online ? secondary.id : primary.id,
      displayName:
        primary.displayName ||
        primary.display_name ||
        secondary.displayName ||
        secondary.display_name,
      online: Boolean(existing.online || row.online),
      joinedAt: joinedCandidates.length ? Math.min(...joinedCandidates) : primary.joinedAt || null,
      leftAt: existing.online || row.online ? null : primary.leftAt || secondary.leftAt || null,
      sessionStart: primary.online
        ? primary.sessionStart || primary.session_start || null
        : null,
      accumulatedMs,
      crmUserId: existing.crmUserId || crmUserId || null,
      email: existing.email || email || null,
      jitsiIds: [...new Set([...(existing.jitsiIds || [existing.id]), row.id])],
    });
  }

  return Array.from(byKey.values());
}

/**
 * Find Jitsi presence for a CRM roster row.
 * Prefer userId / email; fall back to normalized display name.
 * When several rows match (reconnect), prefer the online one.
 */
export function findLivePresence(rosterOrName, liveList) {
  const list = coalesceLivePresence(liveList);
  if (list.length === 0) return null;
  const { userId, email, name } = rosterLookupFields(rosterOrName);

  if (userId) {
    const byUser = list.filter(
      (p) =>
        String(p.crmUserId || p.userId || p.user_id || '').trim() === userId,
    );
    const hit = preferOnlinePresence(byUser);
    if (hit) return hit;
  }

  if (email) {
    const byEmail = list.filter(
      (p) => String(p.email || '').trim().toLowerCase() === email,
    );
    const hit = preferOnlinePresence(byEmail);
    if (hit) return hit;
  }

  const target = normalizeVideoDisplayName(name);
  if (!target) return null;

  const exact = list.filter(
    (p) => normalizeVideoDisplayName(p.displayName || p.display_name) === target,
  );
  const exactHit = preferOnlinePresence(exact);
  if (exactHit) return exactHit;

  const fuzzy = list.filter((p) => {
    const live = normalizeVideoDisplayName(p.displayName || p.display_name);
    return live && (live.includes(target) || target.includes(live));
  });
  return preferOnlinePresence(fuzzy);
}

function rosterIdentityKeys(roster) {
  const { userId, email, name } = rosterLookupFields(roster);
  const keys = new Set();
  if (userId) keys.add(`user:${userId}`);
  if (email) keys.add(`email:${email}`);
  const nameKey = normalizeVideoDisplayName(name);
  if (nameKey) keys.add(`name:${nameKey}`);
  return keys;
}

function liveIdentityKeys(live) {
  const keys = new Set();
  const crmUserId = String(live.crmUserId || live.userId || live.user_id || '').trim();
  const email = String(live.email || '')
    .trim()
    .toLowerCase();
  const nameKey = normalizeVideoDisplayName(live.displayName || live.display_name);
  if (crmUserId) keys.add(`user:${crmUserId}`);
  if (email) keys.add(`email:${email}`);
  if (nameKey) keys.add(`name:${nameKey}`);
  return keys;
}

/**
 * Merge CRM roster with live Jitsi presence.
 * CRM rows win; unmatched live users appear as guests only when they are
 * not the same person as a roster entry (by userId / email / name).
 */
export function mergeRosterWithPresence(participants, livePresence) {
  const live = coalesceLivePresence(livePresence);
  const matchedLiveIds = new Set();
  const rosterKeys = new Set();

  const rows = (Array.isArray(participants) ? participants : []).map((p) => {
    for (const key of rosterIdentityKeys(p)) rosterKeys.add(key);
    const presence = findLivePresence(p, live);
    if (presence?.id) matchedLiveIds.add(presence.id);
    for (const jid of presence?.jitsiIds || []) matchedLiveIds.add(jid);
    const online = Boolean(presence?.online);
    return {
      ...p,
      presence,
      online,
      joinedAt: presence?.joinedAt || presence?.joined_at || null,
      connectionStatus: participantConnectionLabel({ online, presence }),
    };
  });

  for (const entry of live) {
    if (!entry?.id || matchedLiveIds.has(entry.id)) continue;
    if ((entry.jitsiIds || []).some((jid) => matchedLiveIds.has(jid))) continue;
    const liveKeys = liveIdentityKeys(entry);
    let overlapsRoster = false;
    for (const key of liveKeys) {
      if (rosterKeys.has(key)) {
        overlapsRoster = true;
        break;
      }
    }
    if (overlapsRoster) continue;

    const online = Boolean(entry.online);
    const rawName = String(entry.displayName || entry.display_name || '').trim();
    const guestName =
      rawName.replace(/\s*\([^)]*\)\s*$/g, '').replace(/\s+/g, ' ').trim() || 'Гость';
    rows.push({
      role: 'guest',
      name: guestName,
      presence: entry,
      online,
      joinedAt: entry.joinedAt || entry.joined_at || null,
      connectionStatus: participantConnectionLabel({ online, presence: entry }),
    });
  }

  return rows;
}

export function connectedDurationMs(presence, now = Date.now()) {
  if (!presence) return 0;
  const base = Number(presence.accumulatedMs || presence.accumulated_ms || 0);
  const sessionStart = presence.sessionStart || presence.session_start || null;
  if (presence.online && sessionStart) {
    return base + Math.max(0, now - Number(sessionStart));
  }
  return base;
}

export function shouldSuggestPresent(
  presence,
  thresholdMs = ATTENDANCE_SUGGEST_MS,
  now = Date.now(),
) {
  return connectedDurationMs(presence, now) >= thresholdMs;
}

export function formatJoinedAt(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Human-readable conference connection status for the participants list. */
export function participantConnectionLabel({ online, presence }) {
  if (online) return 'в конференции';
  if (presence?.leftAt || presence?.left_at) return 'отключился';
  return 'не подключался';
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
