import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  buildJitsiConfigOverwrite,
  buildJitsiInterfaceConfigOverwrite,
  coalesceLivePresence,
  countOnlineUniqueParticipants,
  loadJitsiExternalApi,
  mapLinkQualityScore,
  mapVideoConferenceError,
  normalizeVideoDisplayName,
  parseJitsiDomain,
  resizeJitsiEmbed,
} from '@/lib/lesson-video';
import {
  isAuthVideoError,
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
 * Temporary disconnect ≠ leave. Only markIntentionalLeave()/hangup from CRM
 * may call onLeft → endSession. Unexpected videoConferenceLeft triggers
 * onUnexpectedLeave for soft remount while CRM session stays alive.
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
    /** True after this CRM session already reached connected at least once. */
    recoveryMode = false,
    onLeft,
    onUnexpectedLeave,
    onJoined,
    onError,
    onAudioMuteChanged,
    onVideoMuteChanged,
    onConnectionStatus,
    onParticipantCount,
    onPresenceChange,
    onScreenSharingChanged,
    onLinkQualityChanged,
    onAudioUnlockNeeded,
    onEndpointTextMessage,
  },
  ref,
) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const joinedOnceRef = useRef(false);
  const intentionalLeaveRef = useRef(false);
  const effectGenRef = useRef(0);
  const bootJwtRef = useRef(jwt);
  const displayNameRef = useRef(displayName);
  const subjectRef = useRef(subject);
  const crmUserIdRef = useRef(crmUserId);
  const crmEmailRef = useRef(crmEmail);
  const crmThemeRef = useRef(crmTheme === 'dark' ? 'dark' : 'light');
  const recoveryModeRef = useRef(Boolean(recoveryMode));
  const onLeftRef = useRef(onLeft);
  const onUnexpectedLeaveRef = useRef(onUnexpectedLeave);
  const onJoinedRef = useRef(onJoined);
  const onErrorRef = useRef(onError);
  const onAudioMuteChangedRef = useRef(onAudioMuteChanged);
  const onVideoMuteChangedRef = useRef(onVideoMuteChanged);
  const onConnectionStatusRef = useRef(onConnectionStatus);
  const onParticipantCountRef = useRef(onParticipantCount);
  const onPresenceChangeRef = useRef(onPresenceChange);
  const onScreenSharingChangedRef = useRef(onScreenSharingChanged);
  const onLinkQualityChangedRef = useRef(onLinkQualityChanged);
  const onAudioUnlockNeededRef = useRef(onAudioUnlockNeeded);
  const onEndpointTextMessageRef = useRef(onEndpointTextMessage);
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
    recoveryModeRef.current = Boolean(recoveryMode);
    onLeftRef.current = onLeft;
    onUnexpectedLeaveRef.current = onUnexpectedLeave;
    onJoinedRef.current = onJoined;
    onErrorRef.current = onError;
    onAudioMuteChangedRef.current = onAudioMuteChanged;
    onVideoMuteChangedRef.current = onVideoMuteChanged;
    onConnectionStatusRef.current = onConnectionStatus;
    onParticipantCountRef.current = onParticipantCount;
    onPresenceChangeRef.current = onPresenceChange;
    onScreenSharingChangedRef.current = onScreenSharingChanged;
    onLinkQualityChangedRef.current = onLinkQualityChanged;
    onAudioUnlockNeededRef.current = onAudioUnlockNeeded;
    onEndpointTextMessageRef.current = onEndpointTextMessage;
    if (jwt) bootJwtRef.current = jwt;
  }, [
    displayName,
    subject,
    crmUserId,
    crmEmail,
    crmTheme,
    recoveryMode,
    onLeft,
    onUnexpectedLeave,
    onJoined,
    onError,
    onAudioMuteChanged,
    onVideoMuteChanged,
    onConnectionStatus,
    onParticipantCount,
    onPresenceChange,
    onScreenSharingChanged,
    onLinkQualityChanged,
    onAudioUnlockNeeded,
    onEndpointTextMessage,
    jwt,
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
    markIntentionalLeave: () => {
      intentionalLeaveRef.current = true;
    },
    executeCommand: (command, ...args) => {
      try {
        if (command === 'hangup') {
          intentionalLeaveRef.current = true;
        }
        if (
          command === 'toggleAudio' ||
          command === 'toggleVideo' ||
          command === 'toggleShareScreen' ||
          command === 'setAudioMute' ||
          command === 'setVideoMute'
        ) {
          const api = apiRef.current;
          videoDiag('jitsi_command', {
            command,
            args: args.length ? args.slice(0, 2) : undefined,
            beforeAudioMuted:
              typeof api?.isAudioMuted === 'function' ? api.isAudioMuted() : null,
            beforeVideoMuted:
              typeof api?.isVideoMuted === 'function' ? api.isVideoMuted() : null,
            localId: api?.getMyUserId?.() || null,
            source: 'crm_shell',
          });
        }
        apiRef.current?.executeCommand?.(command, ...args);
        // One-shot sync after share toggle — events can lag behind the picker.
        if (command === 'toggleShareScreen') {
          const api = apiRef.current;
          window.setTimeout(() => {
            void (async () => {
              try {
                const sharing = await api?.isSharingScreen?.();
                if (typeof sharing === 'boolean') {
                  videoDiag('screen_share_sync', {
                    on: sharing,
                    source: 'isSharingScreen_after_toggle',
                  });
                  onScreenSharingChangedRef.current?.(sharing, {
                    isLocal: true,
                    source: 'isSharingScreen_after_toggle',
                  });
                  const localId = api?.getMyUserId?.();
                  if (localId) {
                    // presence patch happens inside listener path; keep map in sync
                    const existing = presenceMapRef.current.get(localId);
                    if (existing) {
                      presenceMapRef.current.set(localId, {
                        ...existing,
                        screenSharing: sharing,
                      });
                    }
                  }
                }
              } catch (err) {
                videoDiagWarn('screen_share_sync_failed', {
                  message: err?.message || String(err),
                });
              }
            })();
          }, 600);
        }
      } catch (err) {
        videoDiagError('jitsi_command_failed', {
          command,
          message: err?.message || String(err),
        });
      }
    },
    dispose: () => {
      videoDiag('jitsi_api_dispose', {
        source: 'imperative_dispose',
        room: roomName || null,
      });
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
    /**
     * User gesture: resume AudioContext + nudge iframe so remote tracks play
     * after browser autoplay policy blocked the async join.
     * Never mutes remote streams — local preview may stay muted separately.
     */
    unlockRemoteAudio: async () => {
      videoDiag('audio_unlock_gesture', {
        joined: joinedOnceRef.current,
        room: roomName || null,
        crmUserId: crmUserIdRef.current || null,
      });
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          if (ctx.state === 'suspended') await ctx.resume();
          // Short silent buffer keeps the context alive for media elements.
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        }
      } catch {
        // ignore
      }
      try {
        const iframe = apiRef.current?.getIFrame?.();
        if (iframe) {
          // Keep Permissions Policy aligned with getUserMedia + autoplay.
          iframe.setAttribute(
            'allow',
            'camera; microphone; display-capture; autoplay; clipboard-write; fullscreen',
          );
          iframe.allow =
            'camera; microphone; display-capture; autoplay; clipboard-write; fullscreen';
          iframe?.contentWindow?.focus?.();
          iframe?.focus?.();
        }
      } catch {
        // ignore
      }
      // Cross-origin iframe: cannot touch remote <audio>/<video>. Focus +
      // AudioContext resume is the supported unlock path for External API.
      onAudioUnlockNeededRef.current?.(false);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    const generation = ++effectGenRef.current;
    let bootTimeout = null;
    let syncInterval = null;
    let mediaProbeTimer = null;
    let participantSyncTimer = null;
    /** @type {Array<[string, Function]>} */
    const boundListeners = [];
    joinedOnceRef.current = false;
    intentionalLeaveRef.current = false;
    presenceMapRef.current = new Map();
    setBooting(true);
    onConnectionStatusRef.current?.(
      recoveryModeRef.current ? 'reconnecting' : 'connecting',
    );
    onPresenceChangeRef.current?.([]);
    onLinkQualityChangedRef.current?.('unknown', null);

    const stillCurrent = () =>
      !cancelled && effectGenRef.current === generation;

    const host = domain || parseJitsiDomain(roomUrl);
    const name = roomName || '';
    const bootJwt = bootJwtRef.current || jwt;

    videoDiag('connect_start', {
      host,
      room: name,
      hasJwt: Boolean(bootJwt),
      generation,
      recoveryMode: recoveryModeRef.current,
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
        videoDiag('jitsi_api_created', {
          host,
          room: name,
          crmUserId: crmUserIdRef.current || null,
          startWithAudioMuted: true,
          startWithVideoMuted: true,
          ignoreStartMuted: true,
        });
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
          iframe.setAttribute(
            'allow',
            'camera; microphone; display-capture; autoplay; clipboard-write; fullscreen',
          );
          iframe.allow =
            'camera; microphone; display-capture; autoplay; clipboard-write; fullscreen';
          iframe.setAttribute('allowfullscreen', 'true');
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
          const coalesced = coalesceLivePresence(raw);
          onPresenceChangeRef.current?.(coalesced);
          // SSOT count = unique online CRM identities (not raw Jitsi endpoints).
          onParticipantCountRef.current?.(countOnlineUniqueParticipants(coalesced));
        };

        /**
         * One authenticated CRM user → one map row. Extra Jitsi endpoints
         * (reconnect / second tab) collapse onto the preferred pid.
         */
        const collapsePresenceByCrmUser = (preferredPid) => {
          const preferred = presenceMapRef.current.get(preferredPid);
          const crmId = String(preferred?.crmUserId || '').trim();
          if (!preferred || !crmId) return;
          for (const [pid, row] of [...presenceMapRef.current.entries()]) {
            if (pid === preferredPid) continue;
            if (String(row.crmUserId || '').trim() !== crmId) continue;
            const preferIncoming = Boolean(preferred.online) || !row.online;
            const keep = preferIncoming ? preferred : row;
            const drop = preferIncoming ? row : preferred;
            const keepPid = preferIncoming ? preferredPid : pid;
            const dropPid = preferIncoming ? pid : preferredPid;
            const joinedCandidates = [keep.joinedAt, drop.joinedAt]
              .map((v) => (v == null ? null : Number(v)))
              .filter((v) => Number.isFinite(v));
            presenceMapRef.current.delete(dropPid);
            presenceMapRef.current.set(keepPid, {
              ...keep,
              id: keepPid,
              displayName: keep.displayName || drop.displayName,
              online: Boolean(keep.online || drop.online),
              joinedAt: joinedCandidates.length
                ? Math.min(...joinedCandidates)
                : keep.joinedAt || drop.joinedAt || null,
              leftAt: keep.online || drop.online ? null : keep.leftAt || drop.leftAt,
              accumulatedMs: Math.max(
                Number(keep.accumulatedMs || 0),
                Number(drop.accumulatedMs || 0),
              ),
              crmUserId: crmId,
              email: keep.email || drop.email || null,
              jitsiIds: [
                ...new Set([
                  ...(keep.jitsiIds || [keep.id]),
                  ...(drop.jitsiIds || [drop.id]),
                ]),
              ],
            });
            if (!preferIncoming) {
              // kept alternate pid — stop iterating on stale preferred
              return;
            }
          }
        };

        const patchPresence = (id, patch) => {
          if (!id) return;
          const existing = presenceMapRef.current.get(id);
          if (!existing) return;
          presenceMapRef.current.set(id, { ...existing, ...patch });
          if (patch?.crmUserId) collapsePresenceByCrmUser(id);
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
          if (extras.crmUserId) collapsePresenceByCrmUser(id);
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

        const extractIdentityExtras = (row = {}) => {
          const flags = readMuteFlags(row);
          const props = row?.participantProperties || row?.properties || {};
          const identity = row?.identity || row?.jwtId || null;
          const crmUserId =
            props.crmUserId ||
            props.crm_user_id ||
            row?.crmUserId ||
            row?.userId ||
            row?.idFromJWT ||
            (typeof identity === 'string' ? identity : identity?.user?.id) ||
            null;
          const email =
            props.crmEmail ||
            props.crm_email ||
            row?.email ||
            (typeof identity === 'object' ? identity?.user?.email : null) ||
            null;
          return {
            ...flags,
            crmUserId: crmUserId ? String(crmUserId) : null,
            email: email ? String(email).toLowerCase() : null,
            screenSharing: Boolean(
              row?.sharingScreen || row?.isSharingScreen || row?.screenSharing,
            ),
          };
        };

        const syncParticipants = () => {
          // Do NOT use raw Jitsi endpoint count for CRM chrome —
          // it counts ghost/reconnect endpoints and inflates the badge.
          try {
            const info = api.getParticipantsInfo?.() || [];
            if (!Array.isArray(info) || info.length === 0) {
              emitPresence();
              return;
            }
            const seen = new Set();
            for (const row of info) {
              const pid = row?.participantId || row?.id;
              if (!pid) continue;
              seen.add(pid);
              markOnline(
                pid,
                row.displayName || row.formattedDisplayName,
                extractIdentityExtras(row),
              );
            }
            for (const [pid, row] of presenceMapRef.current.entries()) {
              if (!seen.has(pid) && row.online) markOffline(pid);
            }
            const snapshot = Array.from(presenceMapRef.current.values());
            videoDiag('presence_sync', {
              room: name,
              rawEndpoints: info.length,
              uniqueOnline: countOnlineUniqueParticipants(snapshot),
              crmUserId: crmUserIdRef.current || null,
            });
            emitPresence();
          } catch {
            emitPresence();
          }
        };

        const reportLeave = (reason = 'left') => {
          if (!stillCurrent()) return;
          const intentional = intentionalLeaveRef.current;
          videoDiag('conference_left', {
            reason,
            joined: joinedOnceRef.current,
            intentional,
            recoveryMode: recoveryModeRef.current,
            generation,
          });
          if (!joinedOnceRef.current && !recoveryModeRef.current) return;

          if (intentional) {
            onConnectionStatusRef.current?.('left');
            onLinkQualityChangedRef.current?.('unknown', null);
            onLeftRef.current?.({ intentional: true, reason });
            return;
          }

          // Temporary drop / bridge failure — keep CRM session, soft remount.
          onConnectionStatusRef.current?.('interrupted');
          onLinkQualityChangedRef.current?.('lost', 0);
          onConnectionStatusRef.current?.('reconnecting');
          onUnexpectedLeaveRef.current?.({ reason, generation });
        };

        /**
         * Soft network flaps → interrupted/reconnecting (never endSession).
         * Auth → parent remounts with fresh JWT.
         * Boot failures while recovering → soft remount path, not endSession.
         */
        const reportError = (err, source = 'error') => {
          if (!stillCurrent()) return;
          const mapped = mapVideoConferenceError(err);
          const authLike = isAuthVideoError(err) || mapped.code === 'auth';
          const hadLiveSession =
            joinedOnceRef.current || recoveryModeRef.current;
          const transient =
            (isTransientVideoError(err) && hadLiveSession) ||
            (hadLiveSession && !authLike && !isMediaPermissionLike(err));

          const stack =
            err instanceof Error
              ? err.stack
              : typeof err === 'object' && err?.stack
                ? String(err.stack)
                : undefined;

          if (authLike && hadLiveSession) {
            videoDiagWarn('conference_error_auth', {
              source,
              code: mapped.code,
              message: mapped.description,
            });
            setBooting(false);
            onConnectionStatusRef.current?.('reconnecting');
            onErrorRef.current?.(
              Object.assign(new Error(mapped.description), {
                title: mapped.title,
                code: mapped.code || 'auth',
                fatal: false,
                transient: false,
                auth: true,
                source,
              }),
            );
            return;
          }

          if (transient || (hadLiveSession && source !== 'missing_jwt')) {
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
              fatal: false,
              transient: false,
              source,
            }),
          );
        };

        function isMediaPermissionLike(raw) {
          const text = String(
            typeof raw === 'string'
              ? raw
              : raw?.message || raw?.error || raw?.code || '',
          ).toLowerCase();
          return (
            text.includes('not-allowed') ||
            text.includes('permission') ||
            text.includes('denied') ||
            text.includes('getusermedia')
          );
        }

        listen(api, 'videoConferenceJoined', (e) => {
          if (!stillCurrent()) return;
          joinedOnceRef.current = true;
          setBooting(false);
          onConnectionStatusRef.current?.('connected');
          const joinedLocalId = e?.id || api.getMyUserId?.();
          let joinedAudioMuted = null;
          let joinedVideoMuted = null;
          try {
            joinedAudioMuted =
              typeof api.isAudioMuted === 'function' ? api.isAudioMuted() : null;
          } catch {
            // ignore
          }
          try {
            joinedVideoMuted =
              typeof api.isVideoMuted === 'function' ? api.isVideoMuted() : null;
          } catch {
            // ignore
          }
          videoDiag('conference_joined', {
            participantId: joinedLocalId || null,
            room: name,
            crmUserId: crmUserIdRef.current || null,
            p2pEnabled: true,
            audioMuted: joinedAudioMuted,
            videoMuted: joinedVideoMuted,
            recoveryMode: recoveryModeRef.current,
            generation,
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
          const localId = joinedLocalId;
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
            collapsePresenceByCrmUser(localId);
          }
          // Sync mute flags from Jitsi (source of truth for local mic).
          try {
            const muted = api.isAudioMuted?.();
            if (typeof muted === 'boolean') {
              onAudioMuteChangedRef.current?.(muted);
              if (localId) patchPresence(localId, { audioMuted: muted });
            }
          } catch {
            // ignore
          }
          try {
            const vMuted = api.isVideoMuted?.();
            if (typeof vMuted === 'boolean') {
              videoMutedRef.current = vMuted;
              onVideoMuteChangedRef.current?.(vMuted);
              if (localId) patchPresence(localId, { videoMuted: vMuted });
            }
          } catch {
            // ignore
          }
          // Async iframe join often loses the prejoin user-gesture → remote
          // autoplay blocked. Ask CRM shell to show “enable sound” CTA.
          onAudioUnlockNeededRef.current?.(true);
          syncParticipants();
          // Prove media path: after remotes join, connectionQuality must leave 0.
          mediaProbeTimer = window.setTimeout(() => {
            if (!stillCurrent() || !joinedOnceRef.current) return;
            const online = Array.from(presenceMapRef.current.values()).filter(
              (r) => r.online,
            );
            const remotes = online.filter((r) => r.id !== api.getMyUserId?.());
            const lost = remotes.filter(
              (r) =>
                r.linkQuality === 'lost' ||
                r.connectionQuality === 0 ||
                r.reconnecting,
            );
            videoDiag(
              remotes.length && lost.length === remotes.length
                ? 'remote_media_missing'
                : 'remote_media_check',
              {
                room: name,
                localId: api.getMyUserId?.() || null,
                onlineCount: online.length,
                remoteCount: remotes.length,
                remotesLost: lost.length,
                crmUserId: crmUserIdRef.current || null,
              },
              remotes.length && lost.length === remotes.length ? 'error' : 'info',
            );
            if (remotes.length && lost.length === remotes.length) {
              onConnectionStatusRef.current?.('degraded');
              onLinkQualityChangedRef.current?.('lost', 0);
            }
          }, 12_000);
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
          const localId = api.getMyUserId?.();
          const pid = e?.id || e?.participantId || localId;
          const isLocal =
            !e?.id && !e?.participantId
              ? true
              : pid === localId || e?.id === localId;
          videoDiag('audio_mute_changed', {
            muted,
            isLocal,
            participantId: pid || null,
            localId: localId || null,
            source: isLocal ? 'jitsi_local_event' : 'jitsi_remote_event',
          });
          // Drive CRM dock ONLY from local mute — remote events must not flip our mic.
          if (isLocal) {
            onAudioMuteChangedRef.current?.(muted);
          }
          if (pid) patchPresence(pid, { audioMuted: muted });
        });
        listen(api, 'videoMuteStatusChanged', (e) => {
          const muted = Boolean(e?.muted);
          const localId = api.getMyUserId?.();
          const pid = e?.id || e?.participantId || localId;
          const isLocal =
            !e?.id && !e?.participantId
              ? true
              : pid === localId || e?.id === localId;
          videoDiag('video_mute_changed', {
            muted,
            isLocal,
            participantId: pid || null,
            localId: localId || null,
            source: isLocal ? 'jitsi_local_event' : 'jitsi_remote_event',
          });
          if (isLocal) {
            videoMutedRef.current = muted;
            onVideoMuteChangedRef.current?.(muted);
          }
          if (pid) patchPresence(pid, { videoMuted: muted });
        });
        listen(api, 'screenSharingStatusChanged', (e) => {
          const on = Boolean(
            e?.on ?? e?.sharing ?? e?.enabled ?? e?.isSharing,
          );
          const details = e?.details || e?.data || {};
          const sourceType =
            details.sourceType ||
            details.desktopSharingSourceType ||
            e?.sourceType ||
            null;
          const localId = api.getMyUserId?.();
          const eventId = e?.id ?? e?.participantId ?? null;
          // External API docs: this event is for the local user; id may be absent.
          const isLocal = !eventId || eventId === localId;
          videoDiag('screen_share', {
            on,
            sourceType,
            isLocal,
            participantId: eventId || localId || null,
            localId: localId || null,
            localAudioMuted:
              typeof api.isAudioMuted === 'function' ? api.isAudioMuted() : null,
            localVideoMuted:
              typeof api.isVideoMuted === 'function' ? api.isVideoMuted() : null,
            rawKeys: e && typeof e === 'object' ? Object.keys(e) : [],
          });
          onScreenSharingChangedRef.current?.(on, {
            sourceType,
            details,
            isLocal,
            participantId: eventId || localId || null,
          });
          const pid = eventId || (isLocal ? localId : null);
          if (pid) patchPresence(pid, { screenSharing: on });
          if (on) {
            try {
              api.executeCommand('setTileView', false);
            } catch {
              // ignore
            }
            // Ensure remote desktop track is on the stage (not a black/empty tile).
            if (!isLocal && pid) {
              try {
                api.executeCommand('pinParticipant', pid);
                api.executeCommand('setLargeVideoParticipant', pid);
                videoDiag('screen_share_pin_remote', { participantId: pid });
              } catch (err) {
                videoDiagWarn('screen_share_pin_failed', {
                  participantId: pid,
                  message: err?.message || String(err),
                });
              }
            }
          }
        });
        listen(api, 'contentSharingParticipantsChanged', (e) => {
          const list = Array.isArray(e)
            ? e
            : Array.isArray(e?.data)
              ? e.data
              : Array.isArray(e?.participantIds)
                ? e.participantIds
                : [];
          const localId = api.getMyUserId?.();
          const ids = list
            .map((row) =>
              typeof row === 'string'
                ? row
                : row?.id || row?.participantId || null,
            )
            .filter(Boolean);
          videoDiag('content_sharing_participants', {
            ids,
            localId: localId || null,
          });
          // Remote presence only — do not infer local dock state from this roster
          // (incomplete lists briefly omit the local id and would flip the button).
          for (const [pid, row] of presenceMapRef.current.entries()) {
            if (!row.online || pid === localId) continue;
            const sharing = ids.includes(pid);
            if (Boolean(row.screenSharing) !== sharing) {
              patchPresence(pid, { screenSharing: sharing });
              if (sharing) {
                try {
                  api.executeCommand('setTileView', false);
                  api.executeCommand('pinParticipant', pid);
                  api.executeCommand('setLargeVideoParticipant', pid);
                } catch {
                  // ignore
                }
              }
            }
          }
          // Local dock: confirm with External API (source of truth for "am I sharing?").
          void (async () => {
            try {
              const sharing = await api.isSharingScreen?.();
              if (typeof sharing !== 'boolean') return;
              onScreenSharingChangedRef.current?.(sharing, {
                isLocal: true,
                source: 'contentSharingParticipantsChanged+isSharingScreen',
                participantId: localId || null,
              });
              if (localId) patchPresence(localId, { screenSharing: sharing });
            } catch {
              // ignore
            }
          })();
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
        listen(api, 'endpointTextMessageReceived', (e) => {
          const senderId =
            e?.senderInfo?.id ||
            e?.from ||
            e?.senderId ||
            e?.participantId ||
            null;
          const text =
            e?.eventData?.text ||
            e?.data?.text ||
            e?.text ||
            (typeof e?.data === 'string' ? e.data : null);
          videoDiag('endpoint_text_message', {
            senderId,
            textPreview: String(text || '').slice(0, 80),
          });
          onEndpointTextMessageRef.current?.({
            senderId,
            text,
            raw: e,
          });
        });
        listen(api, 'participantJoined', (e) => {
          if (!stillCurrent()) return;
          const pid = e?.id;
          const extras = extractIdentityExtras(e || {});
          videoDiag('participant_joined', {
            id: pid || null,
            displayName: e?.displayName || null,
            peerCrmUserId: extras.crmUserId || null,
            localCrmUserId: crmUserIdRef.current || null,
            room: name,
            uniqueOnline: countOnlineUniqueParticipants(
              Array.from(presenceMapRef.current.values()),
            ),
          });
          markOnline(pid, e?.displayName, extras);
          // Re-read roster so jwt/email identity lands ASAP (dedupe reconnects).
          participantSyncTimer = window.setTimeout(() => {
            if (stillCurrent()) syncParticipants();
          }, 250);
          syncParticipants();
        });
        listen(api, 'participantLeft', (e) => {
          if (!stillCurrent()) return;
          videoDiag('participant_left', {
            id: e?.id || null,
            room: name,
            uniqueOnline: Math.max(
              0,
              countOnlineUniqueParticipants(
                Array.from(presenceMapRef.current.values()),
              ) - 1,
            ),
          });
          markOffline(e?.id);
          syncParticipants();
        });
        listen(api, 'participantPropertyChanged', (e) => {
          if (!stillCurrent()) return;
          const pid = e?.id || e?.participantId;
          if (!pid) return;
          const key = e?.property || e?.key;
          const value = e?.newValue ?? e?.value;
          if (key === 'crmUserId' && value) {
            videoDiag('participant_identity', {
              id: pid,
              crmUserId: String(value),
              room: name,
            });
            patchPresence(pid, { crmUserId: String(value) });
            collapsePresenceByCrmUser(pid);
          }
          if (key === 'crmEmail' && value) {
            patchPresence(pid, { email: String(value).toLowerCase() });
            collapsePresenceByCrmUser(pid);
          }
        });
        listen(api, 'displayNameChange', (e) => {
          if (!stillCurrent()) return;
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
          if (!stillCurrent()) return;
          videoDiagWarn('connection_interrupted', {
            room: name,
            visibility: document.visibilityState,
            online: navigator.onLine,
            generation,
          });
          onConnectionStatusRef.current?.('interrupted');
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
          if (!stillCurrent()) return;
          videoDiag('connection_restored', {
            room: name,
            visibility: document.visibilityState,
            generation,
          });
          onConnectionStatusRef.current?.(
            joinedOnceRef.current ? 'connected' : 'connecting',
          );
          const localId = api.getMyUserId?.();
          if (localId) {
            patchPresence(localId, { reconnecting: false });
          }
          // Remote tracks often need a user-gesture unlock after ICE restore.
          onAudioUnlockNeededRef.current?.(true);
          syncParticipants();
        });
        listen(api, 'connectionQualityChanged', (e) => {
          if (!stillCurrent()) return;
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
              onConnectionStatusRef.current?.('interrupted');
              onConnectionStatusRef.current?.('reconnecting');
            } else if (quality === 'poor' || quality === 'fair') {
              onConnectionStatusRef.current?.('degraded');
            } else if (joinedOnceRef.current && (quality === 'good' || quality === 'excellent')) {
              onConnectionStatusRef.current?.('connected');
            }
          }
        });
        listen(api, 'participantConnectionStatusChanged', (e) => {
          if (!stillCurrent()) return;
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
          if (stillCurrent() && joinedOnceRef.current) syncParticipants();
        }, 5000);
        bootTimeout = window.setTimeout(() => {
          if (stillCurrent()) setBooting(false);
        }, 12_000);
      } catch (err) {
        if (stillCurrent()) {
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
      if (mediaProbeTimer) window.clearTimeout(mediaProbeTimer);
      if (participantSyncTimer) window.clearTimeout(participantSyncTimer);
      const api = apiRef.current;
      videoDiag('jitsi_api_dispose', {
        source: 'effect_cleanup',
        room: name,
        joined: joinedOnceRef.current,
        generation,
      });
      detachAll(api);
      try {
        api?.dispose?.();
      } catch {
        // ignore
      }
      if (effectGenRef.current === generation) {
        apiRef.current = null;
      }
      presenceMapRef.current = new Map();
      onPresenceChangeRef.current?.([]);
      onParticipantCountRef.current?.(0);
      onAudioUnlockNeededRef.current?.(false);
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

  // Temporary: accept iframe getStats summaries (plugin.head.html telemetry).
  // Mute icons are explicitly NOT treated as proof of media.
  useEffect(() => {
    const onMessage = (event) => {
      const data = event?.data;
      if (!data || data.source !== 'longhua-jitsi-media-telemetry') return;
      const payload = data.payload || {};
      const classification = payload.classification || {};
      videoDiag('media_path_rtp', {
        classification: classification.likelyCase || null,
        localAudioSending: classification.localAudioSending ?? null,
        localVideoSending: classification.localVideoSending ?? null,
        remoteAudioReceiving: classification.remoteAudioReceiving ?? null,
        remoteVideoReceiving: classification.remoteVideoReceiving ?? null,
        iceConnected: classification.iceConnected ?? null,
        iceFailed: classification.iceFailed ?? null,
        pcCount: Array.isArray(payload.peerConnections)
          ? payload.peerConnections.length
          : 0,
        iceStates: Array.isArray(payload.peerConnections)
          ? payload.peerConnections.map((p) => p?.iceConnectionState || null)
          : [],
        outboundAudioPackets:
          payload.peerConnections?.[0]?.outbound?.audio?.packetsSent ?? null,
        outboundVideoPackets:
          payload.peerConnections?.[0]?.outbound?.video?.packetsSent ?? null,
        inboundAudioPackets:
          payload.peerConnections?.[0]?.inbound?.audio?.packetsReceived ?? null,
        inboundVideoPackets:
          payload.peerConnections?.[0]?.inbound?.video?.packetsReceived ?? null,
        selectedLocalCandidateType:
          payload.peerConnections?.[0]?.localCandidate?.type ?? null,
        selectedRemoteCandidateType:
          payload.peerConnections?.[0]?.remoteCandidate?.type ?? null,
        note: 'RTP/ICE evidence — not mute-icon state',
      });
      if (
        classification.localAudioSending &&
        classification.localVideoSending &&
        !classification.remoteAudioReceiving &&
        !classification.remoteVideoReceiving
      ) {
        videoDiagError('media_path_one_way_or_dead_remote', {
          classification: classification.likelyCase || null,
          iceFailed: classification.iceFailed ?? null,
          iceConnected: classification.iceConnected ?? null,
        });
        onConnectionStatusRef.current?.('degraded');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

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
      onConnectionStatusRef.current?.('interrupted');
      onConnectionStatusRef.current?.('reconnecting');
      onLinkQualityChangedRef.current?.('fair', null);
      if (onlineTimer) window.clearTimeout(onlineTimer);
      onlineTimer = window.setTimeout(() => {
        if (joinedOnceRef.current) {
          onConnectionStatusRef.current?.('connected');
          onAudioUnlockNeededRef.current?.(true);
        }
      }, 1200);
    };
    const onOffline = () => {
      if (!joinedOnceRef.current) return;
      videoDiagWarn('browser_offline', { joined: true });
      onConnectionStatusRef.current?.('interrupted');
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
