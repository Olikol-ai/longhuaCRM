import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  buildJitsiConfigOverwrite,
  buildJitsiInterfaceConfigOverwrite,
  coalesceLivePresence,
  loadJitsiExternalApi,
  normalizeVideoDisplayName,
  parseJitsiDomain,
  resizeJitsiEmbed,
} from '@/lib/lesson-video';

/**
 * Embeds a lesson via JitsiMeetExternalAPI.
 * Native toolbar is hidden — control via ref.executeCommand from CRM shell.
 *
 * Conference identity (domain + room) mounts once. JWT / displayName / subject
 * updates must NOT dispose+recreate the iframe (that was breaking the UI).
 */
const JitsiLessonEmbed = forwardRef(function JitsiLessonEmbed(
  {
    domain,
    roomName,
    roomUrl,
    displayName,
    subject = null,
    externalApiUrl,
    jwt = null,
    crmUserId = null,
    crmEmail = null,
    crmTheme = 'light',
    onLeft,
    onJoined,
    onError,
    onAudioMuteChanged,
    onVideoMuteChanged,
    onConnectionStatus,
    onParticipantCount,
    onPresenceChange,
  },
  ref,
) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const joinedOnceRef = useRef(false);
  const bootJwtRef = useRef(jwt);
  const displayNameRef = useRef(displayName);
  const subjectRef = useRef(subject);
  const crmUserIdRef = useRef(crmUserId);
  const crmEmailRef = useRef(crmEmail);
  const crmThemeRef = useRef(crmTheme === 'dark' ? 'dark' : 'light');
  const onLeftRef = useRef(onLeft);
  const onJoinedRef = useRef(onJoined);
  const onErrorRef = useRef(onError);
  const onAudioMuteChangedRef = useRef(onAudioMuteChanged);
  const onVideoMuteChangedRef = useRef(onVideoMuteChanged);
  const onConnectionStatusRef = useRef(onConnectionStatus);
  const onParticipantCountRef = useRef(onParticipantCount);
  const onPresenceChangeRef = useRef(onPresenceChange);
  /** @type {React.MutableRefObject<Map<string, object>>} */
  const presenceMapRef = useRef(new Map());
  const [booting, setBooting] = useState(true);

  // Keep latest props for listeners without re-creating the conference.
  useEffect(() => {
    displayNameRef.current = displayName;
    subjectRef.current = subject;
    crmUserIdRef.current = crmUserId;
    crmEmailRef.current = crmEmail;
    crmThemeRef.current = crmTheme === 'dark' ? 'dark' : 'light';
    onLeftRef.current = onLeft;
    onJoinedRef.current = onJoined;
    onErrorRef.current = onError;
    onAudioMuteChangedRef.current = onAudioMuteChanged;
    onVideoMuteChangedRef.current = onVideoMuteChanged;
    onConnectionStatusRef.current = onConnectionStatus;
    onParticipantCountRef.current = onParticipantCount;
    onPresenceChangeRef.current = onPresenceChange;
  }, [
    displayName,
    subject,
    crmUserId,
    crmEmail,
    crmTheme,
    onLeft,
    onJoined,
    onError,
    onAudioMuteChanged,
    onVideoMuteChanged,
    onConnectionStatus,
    onParticipantCount,
    onPresenceChange,
  ]);

  // Apply identity changes to the live conference — never remount for this.
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !joinedOnceRef.current) return;
    try {
      if (displayName) api.executeCommand('displayName', displayName);
      if (subject) api.executeCommand('subject', subject);
    } catch {
      // ignore
    }
  }, [displayName, subject]);

  useImperativeHandle(ref, () => ({
    executeCommand: (command, ...args) => {
      try {
        apiRef.current?.executeCommand?.(command, ...args);
      } catch {
        // ignore
      }
    },
    dispose: () => {
      try {
        apiRef.current?.dispose?.();
      } catch {
        // ignore
      }
      apiRef.current = null;
    },
    resize: () => {
      resizeJitsiEmbed(apiRef.current, containerRef.current, {
        crmTheme: crmThemeRef.current,
      });
    },
  }));

  // Mount conference once per domain + room (+ script URL). JWT is snapshotted at boot.
  useEffect(() => {
    let cancelled = false;
    let bootTimeout = null;
    joinedOnceRef.current = false;
    presenceMapRef.current = new Map();
    setBooting(true);
    onConnectionStatusRef.current?.('connecting');
    onPresenceChangeRef.current?.([]);

    const host = domain || parseJitsiDomain(roomUrl);
    const name = roomName || '';
    const bootJwt = bootJwtRef.current || jwt;

    if (!host || !name || !containerRef.current) return undefined;

    if (!bootJwt) {
      onErrorRef.current?.(new Error('Нет токена доступа к видеоконференции'));
      onConnectionStatusRef.current?.('failed');
      setBooting(false);
      return undefined;
    }

    // Capture JWT for this mount only — later prop jwt changes must not re-run this effect.
    bootJwtRef.current = bootJwt;

    (async () => {
      try {
        const JitsiMeetExternalAPI = await loadJitsiExternalApi(host, externalApiUrl);
        if (cancelled || !containerRef.current) return;

        // Dispose any stale instance before creating one (StrictMode / fast remount).
        try {
          apiRef.current?.dispose?.();
        } catch {
          // ignore
        }
        apiRef.current = null;
        containerRef.current.innerHTML = '';

        const options = {
          roomName: name,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          lang: 'ru',
          jwt: bootJwt,
          userInfo: {
            displayName: displayNameRef.current || 'Участник',
            ...(crmEmailRef.current ? { email: crmEmailRef.current } : {}),
          },
          configOverwrite: buildJitsiConfigOverwrite({
            subject: subjectRef.current,
            crmTheme: crmThemeRef.current,
          }),
          interfaceConfigOverwrite: buildJitsiInterfaceConfigOverwrite(),
          onload: () => {
            resizeJitsiEmbed(apiRef.current, containerRef.current, {
              crmTheme: crmThemeRef.current,
            });
          },
        };

        const api = new JitsiMeetExternalAPI(host, options);
        if (cancelled) {
          try {
            api.dispose?.();
          } catch {
            // ignore
          }
          return;
        }
        apiRef.current = api;
        resizeJitsiEmbed(api, containerRef.current, {
          crmTheme: crmThemeRef.current,
        });

        const iframe = api.getIFrame?.();
        if (iframe) {
          iframe.style.colorScheme =
            crmThemeRef.current === 'dark' ? 'dark' : 'light';
          iframe.addEventListener('load', () => {
            resizeJitsiEmbed(api, containerRef.current, {
              crmTheme: crmThemeRef.current,
            });
            iframe.style.background = '#0a0a0a';
          });
        }

        const applyIdentity = () => {
          try {
            const dn = displayNameRef.current;
            const subj = subjectRef.current;
            if (dn) api.executeCommand('displayName', dn);
            if (subj) api.executeCommand('subject', subj);
          } catch {
            // ignore
          }
        };

        const emitPresence = () => {
          const raw = Array.from(presenceMapRef.current.values()).map((row) => ({
            id: row.id,
            displayName: row.displayName,
            online: Boolean(row.online),
            joinedAt: row.joinedAt || null,
            leftAt: row.leftAt || null,
            sessionStart: row.sessionStart || null,
            accumulatedMs: row.accumulatedMs || 0,
            crmUserId: row.crmUserId || null,
            email: row.email || null,
          }));
          onPresenceChangeRef.current?.(coalesceLivePresence(raw));
        };

        const findExistingPresenceKey = (id, displayNameValue, extras = {}) => {
          if (presenceMapRef.current.has(id)) return id;
          const crmUserId = String(extras.crmUserId || '').trim();
          const email = String(extras.email || '')
            .trim()
            .toLowerCase();
          const nameKey = normalizeVideoDisplayName(displayNameValue);
          for (const [pid, row] of presenceMapRef.current.entries()) {
            if (crmUserId && row.crmUserId && row.crmUserId === crmUserId) {
              return pid;
            }
            if (email && row.email && String(row.email).toLowerCase() === email) {
              return pid;
            }
            if (
              nameKey &&
              normalizeVideoDisplayName(row.displayName) === nameKey
            ) {
              return pid;
            }
          }
          return null;
        };

        const markOnline = (id, displayNameValue, extras = {}) => {
          if (!id) return;
          const now = Date.now();
          const label =
            (displayNameValue && String(displayNameValue).trim()) ||
            'Участник';
          const existingKey = findExistingPresenceKey(id, label, extras);
          const existing = existingKey
            ? presenceMapRef.current.get(existingKey)
            : null;

          if (existingKey && existingKey !== id) {
            presenceMapRef.current.delete(existingKey);
          }

          if (existing?.online && existingKey === id) {
            presenceMapRef.current.set(id, {
              ...existing,
              displayName: label,
              crmUserId: extras.crmUserId || existing.crmUserId || null,
              email: extras.email || existing.email || null,
            });
          } else {
            presenceMapRef.current.set(id, {
              id,
              displayName: label,
              online: true,
              joinedAt: existing?.joinedAt || now,
              leftAt: null,
              sessionStart: now,
              accumulatedMs: existing?.accumulatedMs || 0,
              crmUserId: extras.crmUserId || existing?.crmUserId || null,
              email: extras.email || existing?.email || null,
            });
          }
          emitPresence();
        };

        const markOffline = (id) => {
          if (!id) return;
          const existing = presenceMapRef.current.get(id);
          if (!existing) return;
          const now = Date.now();
          const sessionMs =
            existing.online && existing.sessionStart
              ? Math.max(0, now - existing.sessionStart)
              : 0;
          presenceMapRef.current.set(id, {
            ...existing,
            online: false,
            leftAt: now,
            sessionStart: null,
            accumulatedMs: (existing.accumulatedMs || 0) + sessionMs,
          });
          emitPresence();
        };

        const syncParticipants = () => {
          try {
            const count = api.getNumberOfParticipants?.();
            if (typeof count === 'number') onParticipantCountRef.current?.(count);
          } catch {
            // ignore
          }

          try {
            const info = api.getParticipantsInfo?.() || [];
            if (!Array.isArray(info) || info.length === 0) return;
            const seen = new Set();
            for (const row of info) {
              const pid = row?.participantId || row?.id;
              if (!pid) continue;
              seen.add(pid);
              markOnline(pid, row.displayName || row.formattedDisplayName);
            }
            for (const [pid, row] of presenceMapRef.current.entries()) {
              if (!seen.has(pid) && row.online) markOffline(pid);
            }
          } catch {
            // getParticipantsInfo may be unavailable on older builds
          }
        };

        const reportLeave = () => {
          if (!joinedOnceRef.current) return;
          onConnectionStatusRef.current?.('idle');
          onLeftRef.current?.();
        };

        const reportError = (err) => {
          if (cancelled) return;
          setBooting(false);
          onConnectionStatusRef.current?.('failed');
          const message =
            typeof err === 'string'
              ? err
              : err?.message || err?.error || 'Не удалось подключиться к видеоконференции';
          onErrorRef.current?.(new Error(String(message)));
        };

        api.addListener('videoConferenceJoined', (e) => {
          joinedOnceRef.current = true;
          setBooting(false);
          onConnectionStatusRef.current?.('connected');
          resizeJitsiEmbed(api, containerRef.current, {
            crmTheme: crmThemeRef.current,
          });
          applyIdentity();
          const localId = e?.id || api.getMyUserId?.();
          const localExtras = {
            crmUserId: crmUserIdRef.current || null,
            email: crmEmailRef.current || null,
          };
          if (localId) {
            markOnline(localId, displayNameRef.current || 'Участник', localExtras);
            try {
              if (localExtras.crmUserId) {
                api.executeCommand(
                  'setParticipantProperty',
                  'crmUserId',
                  String(localExtras.crmUserId),
                );
              }
              if (localExtras.email) {
                api.executeCommand(
                  'setParticipantProperty',
                  'crmEmail',
                  String(localExtras.email),
                );
              }
            } catch {
              // older Jitsi builds may not support participant properties
            }
          }
          syncParticipants();
          onJoinedRef.current?.();
        });
        api.addListener('readyToClose', reportLeave);
        api.addListener('videoConferenceLeft', reportLeave);
        api.addListener('connectionFailed', (e) => {
          reportError(e?.message || e?.error || 'Ошибка соединения с видеосервером');
        });
        api.addListener('conferenceFailed', (e) => {
          reportError(e?.error || e?.message || 'Не удалось войти в конференцию');
        });
        api.addListener('errorOccurred', (e) => {
          reportError(e?.error?.message || e?.message || 'Ошибка видеоконференции');
        });
        api.addListener('audioMuteStatusChanged', (e) => {
          onAudioMuteChangedRef.current?.(Boolean(e?.muted));
        });
        api.addListener('videoMuteStatusChanged', (e) => {
          onVideoMuteChangedRef.current?.(Boolean(e?.muted));
        });
        api.addListener('participantJoined', (e) => {
          markOnline(e?.id, e?.displayName);
          syncParticipants();
        });
        api.addListener('participantLeft', (e) => {
          markOffline(e?.id);
          syncParticipants();
        });
        api.addListener('participantPropertyChanged', (e) => {
          const pid = e?.id || e?.participantId;
          if (!pid) return;
          const key = e?.property || e?.key;
          const value = e?.newValue ?? e?.value;
          const existing = presenceMapRef.current.get(pid);
          if (!existing) return;
          if (key === 'crmUserId' && value) {
            presenceMapRef.current.set(pid, {
              ...existing,
              crmUserId: String(value),
            });
            emitPresence();
          }
          if (key === 'crmEmail' && value) {
            presenceMapRef.current.set(pid, {
              ...existing,
              email: String(value).toLowerCase(),
            });
            emitPresence();
          }
        });
        api.addListener('displayNameChange', (e) => {
          const pid = e?.id;
          if (!pid) return;
          const existing = presenceMapRef.current.get(pid);
          if (!existing) {
            markOnline(pid, e?.displayname || e?.displayName);
            return;
          }
          presenceMapRef.current.set(pid, {
            ...existing,
            displayName: e?.displayname || e?.displayName || existing.displayName,
          });
          emitPresence();
        });
        api.addListener('connectionInterrupted', () => {
          onConnectionStatusRef.current?.('reconnecting');
        });
        api.addListener('connectionRestored', () => {
          onConnectionStatusRef.current?.(joinedOnceRef.current ? 'connected' : 'connecting');
        });

        applyIdentity();
        bootTimeout = window.setTimeout(() => {
          if (!cancelled) setBooting(false);
        }, 12_000);
      } catch (err) {
        if (!cancelled) {
          setBooting(false);
          onConnectionStatusRef.current?.('failed');
          onErrorRef.current?.(err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (bootTimeout) window.clearTimeout(bootTimeout);
      try {
        apiRef.current?.dispose?.();
      } catch {
        // ignore
      }
      apiRef.current = null;
      presenceMapRef.current = new Map();
      onPresenceChangeRef.current?.([]);
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
    // Intentionally omit jwt / displayName / subject — remounting on those broke the UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- room identity only
  }, [domain, roomName, roomUrl, externalApiUrl]);

  // Viewport / container size → resize only (rail open/close, orientation).
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const reflow = () =>
      resizeJitsiEmbed(apiRef.current, containerRef.current, {
        crmTheme: crmThemeRef.current,
      });
    const onResize = () => reflow();
    const onOrientation = () => {
      window.setTimeout(reflow, 250);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientation);
    const vv = window.visualViewport;
    vv?.addEventListener?.('resize', onResize);

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => reflow());
      observer.observe(node);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientation);
      vv?.removeEventListener?.('resize', onResize);
      observer?.disconnect?.();
    };
  }, [domain, roomName]);

  // Keep iframe color-scheme in sync with CRM theme without remounting Jitsi.
  useEffect(() => {
    const next = crmTheme === 'dark' ? 'dark' : 'light';
    crmThemeRef.current = next;
    try {
      const iframe = apiRef.current?.getIFrame?.();
      if (iframe) iframe.style.colorScheme = next;
    } catch {
      // ignore
    }
  }, [crmTheme]);

  return (
    <div
      className="absolute inset-0 h-full w-full bg-black"
      data-testid="lesson-video-jitsi-wrap"
      style={{ colorScheme: crmTheme === 'dark' ? 'dark' : 'light' }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full bg-black [&_iframe]:block [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0"
        data-testid="lesson-video-jitsi"
      />
      {booting ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 text-white"
          data-testid="lesson-video-connecting"
        >
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-sm font-medium">Подключение к видеоконференции…</p>
          <p className="text-xs text-white/60">Подождите, идёт установка защищённого канала</p>
        </div>
      ) : null}
    </div>
  );
});

export default JitsiLessonEmbed;
