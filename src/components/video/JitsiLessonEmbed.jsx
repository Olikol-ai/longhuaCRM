import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  buildJitsiConfigOverwrite,
  buildJitsiInterfaceConfigOverwrite,
  hardenJitsiIframe,
  loadJitsiExternalApi,
  parseJitsiDomain,
} from '@/lib/lesson-video';

/**
 * Embeds a lesson via JitsiMeetExternalAPI.
 * Native toolbar is hidden — control via ref.executeCommand from CRM shell.
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
  },
  ref,
) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const onLeftRef = useRef(onLeft);
  const onJoinedRef = useRef(onJoined);
  const onErrorRef = useRef(onError);
  const onAudioMuteChangedRef = useRef(onAudioMuteChanged);
  const onVideoMuteChangedRef = useRef(onVideoMuteChanged);

  useEffect(() => {
    onLeftRef.current = onLeft;
    onJoinedRef.current = onJoined;
    onErrorRef.current = onError;
    onAudioMuteChangedRef.current = onAudioMuteChanged;
    onVideoMuteChangedRef.current = onVideoMuteChanged;
  }, [onLeft, onJoined, onError, onAudioMuteChanged, onVideoMuteChanged]);

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
  }));

  useEffect(() => {
    let cancelled = false;
    const host = domain || parseJitsiDomain(roomUrl);
    const name = roomName || '';

    if (!host || !name || !containerRef.current) return undefined;

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
          userInfo: {
            displayName: displayName || 'Участник',
          },
          configOverwrite: buildJitsiConfigOverwrite({ subject }),
          interfaceConfigOverwrite: buildJitsiInterfaceConfigOverwrite(),
          onload: () => {
            hardenJitsiIframe(apiRef.current);
          },
        };
        if (jwt) options.jwt = jwt;

        const api = new JitsiMeetExternalAPI(host, options);
        apiRef.current = api;
        hardenJitsiIframe(api);

        const iframe = api.getIFrame?.();
        if (iframe) {
          iframe.addEventListener('load', () => hardenJitsiIframe(api));
        }

        const applyIdentity = () => {
          try {
            if (displayName) api.executeCommand('displayName', displayName);
            if (subject) api.executeCommand('subject', subject);
          } catch {
            // ignore
          }
        };

        api.addListener('videoConferenceJoined', () => {
          hardenJitsiIframe(api);
          applyIdentity();
          onJoinedRef.current?.();
        });
        api.addListener('readyToClose', () => {
          onLeftRef.current?.();
        });
        api.addListener('videoConferenceLeft', () => {
          onLeftRef.current?.();
        });
        api.addListener('audioMuteStatusChanged', (e) => {
          onAudioMuteChangedRef.current?.(Boolean(e?.muted));
        });
        api.addListener('videoMuteStatusChanged', (e) => {
          onVideoMuteChangedRef.current?.(Boolean(e?.muted));
        });

        applyIdentity();
      } catch (err) {
        if (!cancelled) onErrorRef.current?.(err);
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

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full bg-black [&_iframe]:w-full [&_iframe]:h-full"
      data-testid="lesson-video-jitsi"
    />
  );
});

export default JitsiLessonEmbed;
