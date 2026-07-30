import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  buildJitsiConfigOverwrite,
  buildJitsiInterfaceConfigOverwrite,
  hardenJitsiIframe,
  loadJitsiExternalApi,
  parseJitsiDomain,
  resizeJitsiEmbed,
} from '@/lib/lesson-video';

/**
 * Embeds a lesson via JitsiMeetExternalAPI.
 * Native toolbar is hidden — control via ref.executeCommand from CRM shell.
 *
 * Important: External API builds https://{domain}/{roomName}.
 * JITSI_BASE_URL must be a host root (e.g. https://meet.example.com), not a path prefix.
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
    onLeft,
    onJoined,
    onError,
    onAudioMuteChanged,
    onVideoMuteChanged,
    onConnectionStatus,
    onParticipantCount,
  },
  ref,
) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const joinedOnceRef = useRef(false);
  const onLeftRef = useRef(onLeft);
  const onJoinedRef = useRef(onJoined);
  const onErrorRef = useRef(onError);
  const onAudioMuteChangedRef = useRef(onAudioMuteChanged);
  const onVideoMuteChangedRef = useRef(onVideoMuteChanged);
  const onConnectionStatusRef = useRef(onConnectionStatus);
  const onParticipantCountRef = useRef(onParticipantCount);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    onLeftRef.current = onLeft;
    onJoinedRef.current = onJoined;
    onErrorRef.current = onError;
    onAudioMuteChangedRef.current = onAudioMuteChanged;
    onVideoMuteChangedRef.current = onVideoMuteChanged;
    onConnectionStatusRef.current = onConnectionStatus;
    onParticipantCountRef.current = onParticipantCount;
  }, [
    onLeft,
    onJoined,
    onError,
    onAudioMuteChanged,
    onVideoMuteChanged,
    onConnectionStatus,
    onParticipantCount,
  ]);

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
      resizeJitsiEmbed(apiRef.current, containerRef.current);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    joinedOnceRef.current = false;
    setBooting(true);
    onConnectionStatusRef.current?.('connecting');
    const host = domain || parseJitsiDomain(roomUrl);
    const name = roomName || '';

    if (!host || !name || !containerRef.current) return undefined;

    if (!jwt) {
      onErrorRef.current?.(new Error('Нет токена доступа к видеоконференции'));
      onConnectionStatusRef.current?.('failed');
      setBooting(false);
      return undefined;
    }

    (async () => {
      try {
        const JitsiMeetExternalAPI = await loadJitsiExternalApi(host, externalApiUrl);
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = '';

        const options = {
          roomName: name,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          lang: 'ru',
          jwt,
          userInfo: {
            displayName: displayName || 'Участник',
          },
          configOverwrite: buildJitsiConfigOverwrite({ subject }),
          interfaceConfigOverwrite: buildJitsiInterfaceConfigOverwrite(),
          onload: () => {
            resizeJitsiEmbed(apiRef.current, containerRef.current);
          },
        };

        const api = new JitsiMeetExternalAPI(host, options);
        apiRef.current = api;
        resizeJitsiEmbed(api, containerRef.current);

        const iframe = api.getIFrame?.();
        if (iframe) {
          iframe.addEventListener('load', () => {
            resizeJitsiEmbed(api, containerRef.current);
            // Keep black behind iframe until conference paints — avoids white flash.
            iframe.style.background = '#000';
          });
        }

        const applyIdentity = () => {
          try {
            if (displayName) api.executeCommand('displayName', displayName);
            if (subject) api.executeCommand('subject', subject);
          } catch {
            // ignore
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

        const syncParticipants = () => {
          try {
            const count = api.getNumberOfParticipants?.();
            if (typeof count === 'number') onParticipantCountRef.current?.(count);
          } catch {
            // ignore
          }
        };

        api.addListener('videoConferenceJoined', () => {
          joinedOnceRef.current = true;
          setBooting(false);
          onConnectionStatusRef.current?.('connected');
          resizeJitsiEmbed(api, containerRef.current);
          applyIdentity();
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
        api.addListener('participantJoined', syncParticipants);
        api.addListener('participantLeft', syncParticipants);
        api.addListener('connectionInterrupted', () => {
          onConnectionStatusRef.current?.('reconnecting');
        });
        api.addListener('connectionRestored', () => {
          onConnectionStatusRef.current?.(joinedOnceRef.current ? 'connected' : 'connecting');
        });

        applyIdentity();
        // Safety: if join never fires, drop the spinner after a while (iframe may still work).
        window.setTimeout(() => {
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
      try {
        apiRef.current?.dispose?.();
      } catch {
        // ignore
      }
      apiRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [domain, roomName, roomUrl, displayName, subject, externalApiUrl, jwt]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const reflow = () => resizeJitsiEmbed(apiRef.current, containerRef.current);
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
  }, [domain, roomName, jwt]);

  return (
    <div className="absolute inset-0 w-full h-full bg-black" data-testid="lesson-video-jitsi-wrap">
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full bg-black [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0 [&_iframe]:bg-black"
        data-testid="lesson-video-jitsi"
      />
      {booting ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-100"
          data-testid="lesson-video-connecting"
        >
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-sm font-medium">Подключение к видеоконференции…</p>
          <p className="text-xs text-slate-400">Подождите, идёт установка защищённого канала</p>
        </div>
      ) : null}
    </div>
  );
});

export default JitsiLessonEmbed;
