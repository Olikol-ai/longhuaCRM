import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from '@/components/ui/use-toast';
import VideoSessionPiPChrome from '@/components/video/VideoSessionPiPChrome';
import {
  copyStylesToPictureInPictureWindow,
  DOCUMENT_PIP_DEFAULT_SIZE,
  isDocumentPictureInPictureSupported,
  registerAutomaticDocumentPiPHandler,
  reparentDomNode,
  requestDocumentPictureInPictureWindow,
  syncMediaSessionConferenceState,
} from '@/lib/documentPictureInPicture';

/**
 * Owns the Document PiP window lifecycle and reparents the live Jitsi host
 * without remounting React's JitsiLessonEmbed (no reconnect).
 */
export function useDocumentVideoPiP({
  active,
  enabled = true,
  jitsiHostRef,
  crmStageRef,
  audioMuted,
  videoMuted,
  screenSharing,
  chatUnread,
  participantCount,
  livePresence,
  pinnedParticipantId,
  isStudent,
  title,
  onToggleAudio,
  onToggleVideo,
  onShareScreen,
  onOpenChat,
  onOpenParticipants,
  onReturnToLesson,
  onHangup,
  onPinParticipant,
  onPipOpened,
  onPipClosed,
  resize,
}) {
  const [pipOpen, setPipOpen] = useState(false);
  const pipWindowRef = useRef(null);
  const pipRootRef = useRef(null);
  const pipStageRef = useRef(null);
  const closingRef = useRef(false);
  const propsRef = useRef({});

  propsRef.current = {
    audioMuted,
    videoMuted,
    screenSharing,
    chatUnread,
    participantCount,
    livePresence,
    pinnedParticipantId,
    isStudent,
    title,
    onToggleAudio,
    onToggleVideo,
    onShareScreen,
    onOpenChat,
    onOpenParticipants,
    onReturnToLesson,
    onHangup,
    onPinParticipant,
  };

  const supported = enabled && isDocumentPictureInPictureSupported();

  const placeJitsiHost = useCallback(() => {
    const host = jitsiHostRef?.current;
    if (!host) return;
    if (pipOpen && pipStageRef.current) {
      reparentDomNode(host, pipStageRef.current);
    } else if (crmStageRef?.current) {
      reparentDomNode(host, crmStageRef.current);
    }
    try {
      resize?.();
    } catch {
      // ignore
    }
  }, [pipOpen, jitsiHostRef, crmStageRef, resize]);

  const renderPipChrome = useCallback(() => {
    const root = pipRootRef.current;
    if (!root) return;
    const p = propsRef.current;
    root.render(
      <VideoSessionPiPChrome
        stageRef={(node) => {
          pipStageRef.current = node;
          if (node && jitsiHostRef?.current) {
            reparentDomNode(jitsiHostRef.current, node);
            try {
              resize?.();
            } catch {
              // ignore
            }
          }
        }}
        title={p.title}
        audioMuted={p.audioMuted}
        videoMuted={p.videoMuted}
        screenSharing={p.screenSharing}
        chatUnread={p.chatUnread}
        participantCount={p.participantCount}
        livePresence={p.livePresence}
        pinnedParticipantId={p.pinnedParticipantId}
        showFilmstrip
        isStudent={p.isStudent}
        onToggleAudio={p.onToggleAudio}
        onToggleVideo={p.onToggleVideo}
        onShareScreen={p.onShareScreen}
        onOpenChat={p.onOpenChat}
        onOpenParticipants={p.onOpenParticipants}
        onReturnToLesson={p.onReturnToLesson}
        onHangup={p.onHangup}
        onPinParticipant={p.onPinParticipant}
      />,
    );
  }, [jitsiHostRef, resize]);

  const closeDocumentPiP = useCallback(
    ({ reason = 'close' } = {}) => {
      if (closingRef.current) return;
      closingRef.current = true;
      const pipWindow = pipWindowRef.current;
      pipWindowRef.current = null;

      // CRITICAL: reparent the live Jitsi host out of the PiP document BEFORE
      // unmounting the PiP React tree. Unmounting while the iframe is still a
      // child of the PiP stage removes it from the DOM and forces reconnect.
      const host = jitsiHostRef?.current;
      const crmStage = crmStageRef?.current;
      const park =
        typeof document !== 'undefined'
          ? document.querySelector('[data-jitsi-park]')
          : null;
      const safeTarget = crmStage || park;
      if (host && safeTarget) {
        reparentDomNode(host, safeTarget);
      }
      pipStageRef.current = null;

      try {
        pipRootRef.current?.unmount?.();
      } catch {
        // ignore
      }
      pipRootRef.current = null;

      setPipOpen(false);
      try {
        resize?.();
      } catch {
        // ignore
      }

      try {
        if (pipWindow && !pipWindow.closed) pipWindow.close();
      } catch {
        // ignore
      }

      closingRef.current = false;
      onPipClosed?.({ reason });
    },
    [crmStageRef, jitsiHostRef, onPipClosed, resize],
  );

  const openDocumentPiP = useCallback(async () => {
    if (!supported) {
      toast({
        title: 'Плавающее окно недоступно',
        description: 'Document Picture-in-Picture поддерживается в Chrome на компьютере.',
      });
      return false;
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      try {
        pipWindowRef.current.focus();
      } catch {
        // ignore
      }
      return true;
    }

    try {
      const pipWindow = await requestDocumentPictureInPictureWindow({
        width: DOCUMENT_PIP_DEFAULT_SIZE.width,
        height: DOCUMENT_PIP_DEFAULT_SIZE.height + 56,
        preferInitialWindowPlacement: true,
      });
      copyStylesToPictureInPictureWindow(pipWindow);
      pipWindowRef.current = pipWindow;

      const mount = pipWindow.document.createElement('div');
      mount.id = 'lh-document-pip-mount';
      mount.style.width = '100%';
      mount.style.height = '100%';
      pipWindow.document.body.appendChild(mount);

      pipRootRef.current = createRoot(mount);
      setPipOpen(true);
      renderPipChrome();

      pipWindow.addEventListener('pagehide', () => {
        closeDocumentPiP({ reason: 'pagehide' });
      });

      onPipOpened?.();
      return true;
    } catch (err) {
      toast({
        title: 'Не удалось открыть плавающее окно',
        description: err?.message || 'Попробуйте ещё раз из окна урока.',
        variant: 'destructive',
      });
      return false;
    }
  }, [supported, renderPipChrome, closeDocumentPiP, onPipOpened]);

  // Keep PiP chrome in sync with live session state.
  // Avoid thrashing the stage callback-ref on every mute tick: only re-render
  // chrome when the PiP window is open; Jitsi host is reparented explicitly.
  useEffect(() => {
    if (!pipOpen) return;
    renderPipChrome();
  }, [
    pipOpen,
    renderPipChrome,
    audioMuted,
    videoMuted,
    screenSharing,
    chatUnread,
    participantCount,
    livePresence,
    pinnedParticipantId,
    title,
  ]);

  useEffect(() => {
    placeJitsiHost();
  }, [placeJitsiHost, pipOpen]);

  // After chrome re-render, ensure host still sits in the PiP stage (not lost
  // if React briefly detached the stage node during reconciliation).
  useEffect(() => {
    if (!pipOpen) return undefined;
    const id = window.requestAnimationFrame(() => placeJitsiHost());
    return () => window.cancelAnimationFrame(id);
  }, [
    pipOpen,
    placeJitsiHost,
    audioMuted,
    videoMuted,
    screenSharing,
    chatUnread,
    participantCount,
    livePresence,
    pinnedParticipantId,
  ]);

  // Media Session: eligibility + auto Document PiP when switching tabs.
  useEffect(() => {
    if (!active || !supported) return undefined;
    syncMediaSessionConferenceState({
      microphoneActive: !audioMuted,
      cameraActive: !videoMuted,
    });
    return registerAutomaticDocumentPiPHandler(async () => {
      if (pipWindowRef.current && !pipWindowRef.current.closed) return;
      await openDocumentPiP();
    });
  }, [active, supported, audioMuted, videoMuted, openDocumentPiP]);

  useEffect(() => {
    if (!active || !supported) return;
    syncMediaSessionConferenceState({
      microphoneActive: !audioMuted,
      cameraActive: !videoMuted,
    });
  }, [active, supported, audioMuted, videoMuted]);

  // End of conference must not leave an orphan PiP window.
  useEffect(() => {
    if (active) return undefined;
    if (pipOpen || pipWindowRef.current) {
      closeDocumentPiP({ reason: 'session_end' });
    }
    return undefined;
  }, [active, pipOpen, closeDocumentPiP]);

  useEffect(() => () => {
    if (pipWindowRef.current || pipRootRef.current) {
      closeDocumentPiP({ reason: 'unmount' });
    }
  }, [closeDocumentPiP]);

  return {
    supported,
    pipOpen,
    openDocumentPiP,
    closeDocumentPiP,
  };
}
