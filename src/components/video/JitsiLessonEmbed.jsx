import { useEffect, useRef } from 'react';
import {
  buildJitsiConfigOverwrite,
  buildJitsiInterfaceConfigOverwrite,
  hardenJitsiIframe,
  loadJitsiExternalApi,
  parseJitsiDomain,
} from '@/lib/lesson-video';

/**
 * Embeds a lesson via JitsiMeetExternalAPI (not a raw iframe src).
 * Mount only after an explicit user action ("Войти в урок") so media / auth
 * popups are tied to a user gesture.
 */
export default function JitsiLessonEmbed({
  domain,
  roomName,
  roomUrl,
  displayName,
  externalApiUrl,
  jwt = null,
  onLeft,
  onJoined,
  onError,
}) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const onLeftRef = useRef(onLeft);
  const onJoinedRef = useRef(onJoined);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onLeftRef.current = onLeft;
    onJoinedRef.current = onJoined;
    onErrorRef.current = onError;
  }, [onLeft, onJoined, onError]);

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
          configOverwrite: buildJitsiConfigOverwrite(),
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

        api.addListener('videoConferenceJoined', () => {
          hardenJitsiIframe(api);
          onJoinedRef.current?.();
        });
        api.addListener('readyToClose', () => {
          onLeftRef.current?.();
        });
        api.addListener('videoConferenceLeft', () => {
          onLeftRef.current?.();
        });
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
  }, [domain, roomName, roomUrl, displayName, externalApiUrl, jwt]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full bg-black [&_iframe]:w-full [&_iframe]:h-full"
      data-testid="lesson-video-jitsi"
    />
  );
}
