import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  buildJitsiConfigOverwrite,
  buildJitsiInterfaceConfigOverwrite,
  coalesceLivePresence,
  loadJitsiExternalApi,
  mapLinkQualityScore,
  mapVideoConferenceError,
  normalizeVideoDisplayName,
  parseJitsiDomain,
  resizeJitsiEmbed,
} from '@/lib/lesson-video';
import {
  isTransientVideoError,
  videoDiag,
  videoDiagError,
  videoDiagWarn,
} from '@/lib/video-diagnostics';

/**
 * Embeds a lesson via JitsiMeetExternalAPI.
 * Native toolbar is hidden — control via ref.executeCommand from CRM shell.
 *
 * Conference identity (domain + room) mounts once. JWT / displayName / subject
 * updates must NOT dispose+recreate the iframe (that was breaking the UI).
 *
 * On unmount every listener, timer and ResizeObserver must be cleared so
 * hangup/leave never leaks WebRTC callbacks into a disposed conference.
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
    onScreenSharingChanged,
    onLinkQualityChanged,
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
  const onScreenSharingChangedRef = useRef(onScreenSharingChanged);
  const onLinkQualityChangedRef = useRef(onLinkQualityChanged);
  /** @type {React.MutableRefObject<Map<string, object>>} */
  const presenceMapRef = useRef(new Map());
  const [booting, setBooting] = useState(true);
  const videoMutedRef = useRef(false);

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
    onScreenSharingChangedRef.current = onScreenSharingChanged;
    onLinkQualityChangedRef.current = onLinkQualityChanged;
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
    onScreenSharingChanged,
    onLinkQualityChanged,
  ]);

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

  useEffect(() => {
    let cancelled = false;
    let bootTimeout = null;
    let syncInterval = null;
    /** @type {Array<[string, Function]>} */
    const boundListeners = [];
    joinedOnceRef.current = false;
    presenceMapRef.current = new Map();
    setBooting(true);
    onConnectionStatusRef.current?.('connecting');
    onPresenceChangeRef.current?.([]);
    onLinkQualityChangedRef.current?.('unknown', null);

    const host = domain || parseJitsiDomain(roomUrl);
    const name = roomName || '';
    const bootJwt = bootJwtRef.current || jwt;

    videoDiag('connect_start', {
      host,
      room: name,
      hasJwt: Boolean(bootJwt),
    });

    if (!host || !name || !containerRef.current) return undefined;

    if (!bootJwt) {
      videoDiagError('missing_jwt', { host, room: name });
      onErrorRef.current?.(
        Object.assign(new Error('Нет токена доступа к видеоконференции'), {
          code: 'missing_jwt',
          fatal: true,
        }),
      );
      onConnectionStatusRef.current?.('failed');
      setBooting(false);
      return undefined;
    }

    bootJwtRef.current = bootJwt;

    const listen = (api, event, handler) => {
      api.addListener(event, handler);
      boundListeners.push([event, handler]);
    };

    const detachAll = (api) => {
      for (const [event, handler] of boundListeners) {
        try {
          api?.removeListener?.(event, handler);
        } catch {
          // ignore
        }
      }
      boundListeners.length = 0;
    };

    (async () => {
      try {
        const JitsiMeetExternalAPI = await loadJitsiExternalApi(host, externalApiUrl);
        if (cancelled || !containerRef.current) return;

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
            audioMuted: row.audioMuted ?? null,
            videoMuted: row.videoMuted ?? null,
            screenSharing: Boolean(row.screenSharing),
            connectionQuality: row.connectionQuality ?? null,
            linkQuality: row.linkQuality || null,
            reconnecting: Boolean(row.reconnecting),
            handRaised: Boolean(row.handRaised),
          }));
          onPresenceChangeRef.current?.(coalesceLivePresence(raw));
        };

        const patchPresence = (id, patch) => {
          if (!id) return;
          const existing = presenceMapRef.current.get(id);
          if (!existing) return;
          presenceMapRef.current.set(id, { ...existing, ...patch });
          emitPresence();
        };

        const findExistingPresenceKey = (id, displayNameValue, extras = {}) => {
          if (presenceMapRef.current.has(id)) return id;
          const crmId = String(extras.crmUserId || '').trim();
          const email = String(extras.email || '')
            .trim()
            .toLowerCase();
          const nameKey = normalizeVideoDisplayName(displayNameValue);
          for (const [pid, row] of presenceMapRef.current.entries()) {
            if (crmId && row.crmUserId && row.crmUserId === crmId) return pid;
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
              audioMuted:
                extras.audioMuted ?? existing.audioMuted ?? null,
              videoMuted:
                extras.videoMuted ?? existing.videoMuted ?? null,
              screenSharing:
                extras.screenSharing ?? existing.screenSharing ?? false,
              reconnecting: false,
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
              audioMuted: extras.audioMuted ?? existing?.audioMuted ?? null,
              videoMuted: extras.videoMuted ?? existing?.videoMuted ?? null,
              screenSharing:
                extras.screenSharing ?? existing?.screenSharing ?? false,
              connectionQuality: existing?.connectionQuality ?? null,
              linkQuality: existing?.linkQuality || 'unknown',
              reconnecting: false,
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
            screenSharing: false,
            reconnecting: false,
            linkQuality: null,
          });
          emitPresence();
        };

        const readMuteFlags = (row) => {
          const audioMuted =
            row?.muted ??
            row?.audioMuted ??
            row?.isAudioMuted ??
            row?.audioMutedStatus;
          const videoMuted =
            row?.videoMuted ?? row?.isVideoMuted ?? row?.videoMutedStatus;
          return {
            audioMuted:
              audioMuted === undefined || audioMuted === null
                ? null
                : Boolean(audioMuted),
            videoMuted:
              videoMuted === undefined || videoMuted === null
                ? null
                : Boolean(videoMuted),
          };
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
              const flags = readMuteFlags(row);
              markOnline(pid, row.displayName || row.formattedDisplayName, {
                ...flags,
                screenSharing: Boolean(
                  row?.sharingScreen || row?.isSharingScreen || row?.screenSharing,
                ),
              });
            }
            for (const [pid, row] of presenceMapRef.current.entries()) {
              if (!seen.has(pid) && row.online) markOffline(pid);
            }
          } catch {
            // getParticipantsInfo may be unavailable on older builds
          }
        };

        const reportLeave = (reason = 'left') => {
          videoDiag('conference_left', { reason, joined: joinedOnceRef.current });
          if (!joinedOnceRef.current) return;
          onConnectionStatusRef.current?.('idle');
          onLinkQualityChangedRef.current?.('unknown', null);
          onLeftRef.current?.();
        };

        /**
         * Fatal → notify parent to end/remount.
         * Transient network flaps → soft reconnect UI only (Jitsi recovers itself).
         */
        const reportError = (err, source = 'error') => {
          if (cancelled) return;
          const mapped = mapVideoConferenceError(err);
          const transient = isTransientVideoError(err) && joinedOnceRef.current;
          const stack =
            err instanceof Error
              ? err.stack
              : typeof err === 'object' && err?.stack
                ? String(err.stack)
                : undefined;

          if (transient) {
            videoDiagWarn('conference_error_transient', {
              source,
              code: mapped.code,
              message: mapped.description,
              raw: String(
                typeof err === 'string'
                  ? err
                  : err?.message || err?.error || err?.code || '',
              ).slice(0, 300),
            });
            setBooting(false);
            onConnectionStatusRef.current?.('reconnecting');
            onLinkQualityChangedRef.current?.('lost', 0);
            onErrorRef.current?.(
              Object.assign(new Error(mapped.description), {
                title: mapped.title,
                code: mapped.code,
                fatal: false,
                transient: true,
                source,
              }),
            );
            return;
          }

          videoDiagError('conference_error_fatal', {
            source,
            code: mapped.code,
            message: mapped.description,
            stack: stack ? String(stack).slice(0, 800) : undefined,
            raw: String(
              typeof err === 'string'
                ? err
                : err?.message || err?.error || err?.code || '',
            ).slice(0, 300),
          });
          setBooting(false);
          onConnectionStatusRef.current?.('failed');
          onLinkQualityChangedRef.current?.('lost', 0);
          onErrorRef.current?.(
            Object.assign(new Error(mapped.description), {
              title: mapped.title,
              code: mapped.code,
              fatal: true,
              transient: false,
              source,
            }),
          );
        };

        listen(api, 'videoConferenceJoined', (e) => {
          joinedOnceRef.current = true;
          setBooting(false);
          onConnectionStatusRef.current?.('connected');
          videoDiag('conference_joined', {
            participantId: e?.id || api.getMyUserId?.() || null,
            room: name,
          });
          resizeJitsiEmbed(api, containerRef.current, {
            crmTheme: crmThemeRef.current,
          });
          applyIdentity();
          // Prefer stage + filmstrip (Zoom-like), never tile grid as default.
          try {
            api.executeCommand('setTileView', false);
          } catch {
            // ignore
          }
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
        listen(api, 'readyToClose', () => reportLeave('readyToClose'));
        listen(api, 'videoConferenceLeft', () => reportLeave('videoConferenceLeft'));
        listen(api, 'connectionFailed', (e) => {
          reportError(
            e?.message || e?.error || 'Ошибка соединения с видеосервером',
            'connectionFailed',
          );
        });
        listen(api, 'conferenceFailed', (e) => {
          reportError(
            e?.error || e?.message || 'Не удалось войти в конференцию',
            'conferenceFailed',
          );
        });
        listen(api, 'errorOccurred', (e) => {
          reportError(
            e?.error?.message || e?.message || 'Ошибка видеоконференции',
            'errorOccurred',
          );
        });
        listen(api, 'audioMuteStatusChanged', (e) => {
          const muted = Boolean(e?.muted);
          onAudioMuteChangedRef.current?.(muted);
          const pid = e?.id || e?.participantId || api.getMyUserId?.();
          patchPresence(pid, { audioMuted: muted });
        });
        listen(api, 'videoMuteStatusChanged', (e) => {
          const muted = Boolean(e?.muted);
          videoMutedRef.current = muted;
          onVideoMuteChangedRef.current?.(muted);
          const pid = e?.id || e?.participantId || api.getMyUserId?.();
          patchPresence(pid, { videoMuted: muted });
        });
        listen(api, 'screenSharingStatusChanged', (e) => {
          const on = Boolean(e?.on);
          const details = e?.details || e?.data || {};
          const sourceType =
            details.sourceType ||
            details.desktopSharingSourceType ||
            e?.sourceType ||
            null;
          videoDiag('screen_share', { on, sourceType });
          onScreenSharingChangedRef.current?.(on, {
            sourceType,
            details,
          });
          const pid = e?.id || e?.participantId || api.getMyUserId?.();
          patchPresence(pid, { screenSharing: on });
          if (on) {
            try {
              api.executeCommand('setTileView', false);
            } catch {
              // ignore
            }
          }
        });
        listen(api, 'raiseHandUpdated', (e) => {
          const pid = e?.id || e?.participantId;
          if (!pid) return;
          const raised =
            e?.handRaised === true ||
            e?.raised === true ||
            Number(e?.handRaised) > 0;
          patchPresence(pid, { handRaised: raised });
        });
        listen(api, 'participantJoined', (e) => {
          videoDiag('participant_joined', {
            id: e?.id || null,
            displayName: e?.displayName || null,
          });
          markOnline(e?.id, e?.displayName);
          syncParticipants();
        });
        listen(api, 'participantLeft', (e) => {
          videoDiag('participant_left', { id: e?.id || null });
          markOffline(e?.id);
          syncParticipants();
        });
        listen(api, 'participantPropertyChanged', (e) => {
          const pid = e?.id || e?.participantId;
          if (!pid) return;
          const key = e?.property || e?.key;
          const value = e?.newValue ?? e?.value;
          if (key === 'crmUserId' && value) {
            patchPresence(pid, { crmUserId: String(value) });
          }
          if (key === 'crmEmail' && value) {
            patchPresence(pid, { email: String(value).toLowerCase() });
          }
        });
        listen(api, 'displayNameChange', (e) => {
          const pid = e?.id;
          if (!pid) return;
          const existing = presenceMapRef.current.get(pid);
          if (!existing) {
            markOnline(pid, e?.displayname || e?.displayName);
            return;
          }
          patchPresence(pid, {
            displayName: e?.displayname || e?.displayName || existing.displayName,
          });
        });
        listen(api, 'connectionInterrupted', () => {
          videoDiagWarn('connection_interrupted', {
            room: name,
            visibility: document.visibilityState,
            online: navigator.onLine,
          });
          onConnectionStatusRef.current?.('reconnecting');
          onLinkQualityChangedRef.current?.('lost', 0);
          const localId = api.getMyUserId?.();
          if (localId) {
            patchPresence(localId, {
              reconnecting: true,
              linkQuality: 'lost',
              connectionQuality: 0,
            });
          }
        });
        listen(api, 'connectionRestored', () => {
          videoDiag('connection_restored', {
            room: name,
            visibility: document.visibilityState,
          });
          onConnectionStatusRef.current?.(
            joinedOnceRef.current ? 'connected' : 'connecting',
          );
          const localId = api.getMyUserId?.();
          if (localId) {
            patchPresence(localId, { reconnecting: false });
          }
        });
        listen(api, 'connectionQualityChanged', (e) => {
          const score = Number(e?.connectionQuality);
          const quality = mapLinkQualityScore(score);
          const localId = api.getMyUserId?.();
          const pid = e?.userID || e?.id || e?.participantId || localId;
          const isLocal =
            !e?.userID && !e?.id
              ? true
              : pid === localId || e?.userID === localId || e?.id === localId;
          if (pid) {
            patchPresence(pid, {
              connectionQuality: Number.isFinite(score) ? score : null,
              linkQuality: quality,
              reconnecting: quality === 'lost',
            });
          }
          if (isLocal) {
            onLinkQualityChangedRef.current?.(quality, score);
            if (quality === 'lost') {
              onConnectionStatusRef.current?.('reconnecting');
            } else if (quality === 'poor' || quality === 'fair') {
              onConnectionStatusRef.current?.('degraded');
            }
          }
        });
        listen(api, 'participantConnectionStatusChanged', (e) => {
          const pid = e?.id || e?.participantId;
          if (!pid) return;
          const status = String(e?.connectionStatus || e?.status || '').toLowerCase();
          if (status === 'interrupted' || status === 'inactive') {
            patchPresence(pid, {
              reconnecting: true,
              linkQuality: 'fair',
            });
          } else if (status === 'active' || status === 'restoring') {
            patchPresence(pid, {
              reconnecting: status === 'restoring',
              linkQuality: status === 'restoring' ? 'fair' : 'good',
            });
          }
        });

        applyIdentity();
        syncInterval = window.setInterval(() => {
          if (!cancelled && joinedOnceRef.current) syncParticipants();
        }, 5000);
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
      if (syncInterval) window.clearInterval(syncInterval);
      const api = apiRef.current;
      detachAll(api);
      try {
        api?.dispose?.();
      } catch {
        // ignore
      }
      apiRef.current = null;
      presenceMapRef.current = new Map();
      onPresenceChangeRef.current?.([]);
      onLinkQualityChangedRef.current?.('unknown', null);
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
    // Intentionally omit jwt / displayName / subject — remounting on those broke the UI.
     
  }, [domain, roomName, roomUrl, externalApiUrl]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    let orientationTimer = null;
    const reflow = () =>
      resizeJitsiEmbed(apiRef.current, containerRef.current, {
        crmTheme: crmThemeRef.current,
      });
    const onResize = () => reflow();
    const onOrientation = () => {
      if (orientationTimer) window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(reflow, 250);
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
      if (orientationTimer) window.clearTimeout(orientationTimer);
      observer?.disconnect?.();
    };
  }, [domain, roomName]);

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

  // Visibility / network soft recovery — never remount the conference.
  useEffect(() => {
    let onlineTimer = null;
    const onVisibility = () => {
      videoDiag('visibility', { state: document.visibilityState });
      if (document.visibilityState !== 'visible') return;
      const api = apiRef.current;
      if (!api || !joinedOnceRef.current) return;
      resizeJitsiEmbed(api, containerRef.current, {
        crmTheme: crmThemeRef.current,
      });
    };
    const onOnline = () => {
      if (!joinedOnceRef.current) return;
      videoDiagWarn('browser_online', { joined: true });
      onConnectionStatusRef.current?.('reconnecting');
      onLinkQualityChangedRef.current?.('fair', null);
      if (onlineTimer) window.clearTimeout(onlineTimer);
      onlineTimer = window.setTimeout(() => {
        if (joinedOnceRef.current) {
          onConnectionStatusRef.current?.('connected');
        }
      }, 1200);
    };
    const onOffline = () => {
      if (!joinedOnceRef.current) return;
      videoDiagWarn('browser_offline', { joined: true });
      onConnectionStatusRef.current?.('reconnecting');
      onLinkQualityChangedRef.current?.('lost', 0);
    };
    // Hot-plug mic/cam/Bluetooth — Jitsi picks devices up; we only reflow chrome.
    const onDeviceChange = () => {
      if (!joinedOnceRef.current) return;
      resizeJitsiEmbed(apiRef.current, containerRef.current, {
        crmTheme: crmThemeRef.current,
      });
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('focus', onVisibility);
    try {
      navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
    } catch {
      // ignore
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', onVisibility);
      if (onlineTimer) window.clearTimeout(onlineTimer);
      try {
        navigator.mediaDevices?.removeEventListener?.(
          'devicechange',
          onDeviceChange,
        );
      } catch {
        // ignore
      }
    };
  }, []);

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
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 text-white animate-in fade-in-0 duration-200"
          data-testid="lesson-video-connecting"
        >
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-sm font-medium">Подключение к видеоконференции…</p>
          <p className="text-xs text-white/60">
            Подождите, идёт установка защищённого канала
          </p>
        </div>
      ) : null}
    </div>
  );
});

export default JitsiLessonEmbed;
