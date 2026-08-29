import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Minimize2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Maximize2,
  PhoneOff,
  MessageCircle,
  Users,
  Pin,
  ClipboardCheck,
  Info,
  PictureInPicture2,
  Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useVideoSession, CORNERS } from '@/lib/VideoSessionContext';
import {
  checkMediaDevices,
  videoConnectionMeta,
} from '@/lib/lesson-video';
import { api } from '@/api';
import { userFacingError } from '@/lib/userFacingError';
import { useIsLgUp } from '@/lib/responsive';
import { cn } from '@/lib/utils';
import JitsiLessonEmbed from '@/components/video/JitsiLessonEmbed';
import LessonVideoControls from '@/components/video/LessonVideoControls';
import LessonVideoSideRail from '@/components/video/LessonVideoSideRail';
import LessonVideoLeaveDialog from '@/components/video/LessonVideoLeaveDialog';
import LessonVideoChatToast from '@/components/video/LessonVideoChatToast';
import LessonVideoScreenShareBar from '@/components/video/LessonVideoScreenShareBar';
import LessonVideoSharePreview from '@/components/video/LessonVideoSharePreview';
import LessonVideoLinkQuality from '@/components/video/LessonVideoLinkQuality';
import LessonVideoParticipantsPanel from '@/components/video/LessonVideoParticipantsPanel';
import LessonVideoAttendancePanel from '@/components/video/LessonVideoAttendancePanel';
import LessonVideoInfoPanel from '@/components/video/LessonVideoInfoPanel';
import VideoScreenShareAudioHint from '@/components/video/VideoScreenShareAudioHint';
import LessonVideoFilmstrip from '@/components/video/LessonVideoFilmstrip';
import { useDocumentVideoPiP } from '@/components/video/useDocumentVideoPiP';
import { videoDiagWarn } from '@/lib/video-diagnostics';

function formatClock(t) {
  if (!t) return '—';
  return String(t).slice(0, 5);
}

function shareLabelFromMeta(meta) {
  const raw = String(meta?.sourceType || meta?.details?.sourceType || '').toLowerCase();
  if (raw.includes('tab') || raw.includes('browser') || raw.includes('chrome')) {
    return 'вкладку браузера';
  }
  if (raw.includes('window') || raw.includes('application')) {
    return 'окно приложения';
  }
  if (raw.includes('screen') || raw.includes('monitor') || raw.includes('desktop')) {
    return 'весь экран';
  }
  return 'экран';
}

function ConnectionPill({ status }) {
  const meta = videoConnectionMeta(status);
  const tone =
    meta.tone === 'ok'
      ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300 dark:ring-emerald-500/30'
      : meta.tone === 'warn'
        ? 'bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-200 dark:ring-amber-500/30'
        : meta.tone === 'bad'
          ? 'bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300 dark:ring-rose-500/30'
          : 'bg-muted text-muted-foreground ring-border';
  const dot =
    meta.tone === 'ok'
      ? 'bg-emerald-500'
      : meta.tone === 'warn'
        ? 'bg-amber-500 animate-pulse'
        : meta.tone === 'bad'
          ? 'bg-rose-500'
          : 'bg-muted-foreground';

  return (
    <span
      className={cn(
        'inline-flex h-7 max-w-[9.5rem] items-center gap-1.5 truncate rounded-full px-2 text-[11px] font-medium ring-1',
        tone,
      )}
      data-testid="lesson-video-connection"
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

/**
 * Persistent Jitsi host + Zoom-like CRM chrome.
 * Full mode: video-first, drawers on demand (no permanent right rail).
 */
export default function VideoSessionLayer() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDesktop = useIsLgUp();
  const stageRef = useRef(null);
  const crmStageRef = useRef(null);
  const jitsiHostRef = useRef(null);
  const [shareAudioHintOpen, setShareAudioHintOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [shareStartedAt, setShareStartedAt] = useState(null);
  const [shareLabel, setShareLabel] = useState('экран');
  const [completeBusy, setCompleteBusy] = useState(false);

  const vs = useVideoSession();
  const {
    active,
    session,
    mode,
    jitsiRef,
    embedKey,
    audioMuted,
    videoMuted,
    screenSharing,
    connectionStatus,
    linkQuality,
    participantCount,
    livePresence,
    audioUnlockNeeded,
    chatUnread,
    chatToast,
    railTab,
    sheetOpen,
    miniPos,
    miniPinned,
    miniSize,
    leaveOpen,
    reconnectRestoredFlash,
    setAudioMuted,
    setVideoMuted,
    setScreenSharing,
    setConnectionStatus,
    setLinkQuality,
    setParticipantCount,
    setLivePresence,
    setAudioUnlockNeeded,
    setChatUnread,
    setChatToast,
    setRailTab,
    setSheetOpen,
    setMiniPos,
    setMiniPinned,
    setLeaveOpen,
    endSession,
    refreshSessionToken,
    minimize,
    enterPipMode,
    exitPipMode,
    expand,
    requestEnd,
    confirmLeave,
    executeCommand,
    resize,
    pinMiniCorner,
  } = vs;

  const [pinnedParticipantId, setPinnedParticipantId] = useState(null);

  const remoteOrLocalShare = Boolean(
    screenSharing ||
      (livePresence || []).some((p) => p?.online && p?.screenSharing),
  );

  useEffect(() => {
    if (!active) return undefined;
    const frame = window.requestAnimationFrame(() => resize());
    const t = window.setTimeout(() => resize(), 280);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(t);
    };
  }, [active, mode, sheetOpen, isDesktop, resize, miniPos, miniSize]);

  useEffect(() => {
    if (mode !== 'mini' || !miniPinned || !miniPos.corner) return undefined;
    const onResize = () => pinMiniCorner(miniPos.corner);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mode, miniPinned, miniPos.corner, pinMiniCorner]);

  useEffect(() => {
    if (screenSharing || remoteOrLocalShare) {
      setShareStartedAt((prev) => prev || Date.now());
    } else {
      setShareStartedAt(null);
      setShareLabel('экран');
    }
  }, [screenSharing, remoteOrLocalShare]);

  // Zoom-like stage: exit tile view when share starts so material fills the stage.
  useEffect(() => {
    if (!active || mode === 'mini' || mode === 'pip' || !remoteOrLocalShare) return;
    try {
      executeCommand('setTileView', false);
    } catch {
      // ignore
    }
  }, [active, mode, remoteOrLocalShare, executeCommand]);

  const openStudyPanel = useCallback(
    (tabId) => {
      setRailTab(tabId || 'chat');
      setSheetOpen(true);
      setParticipantsOpen(false);
    },
    [setRailTab, setSheetOpen],
  );

  const onMiniDragStart = useCallback(
    (event) => {
      if (mode !== 'mini' || event.button !== 0) return;
      if (event.target.closest('[data-mini-action]')) return;
      setMiniPinned(false);
      setDragging(true);
      const startX = event.clientX;
      const startY = event.clientY;
      const origX = miniPos.x;
      const origY = miniPos.y;
      const onMove = (e) => {
        const gap = 16;
        const bottomSafe = 72;
        const maxX = Math.max(gap, window.innerWidth - miniSize.w - gap);
        const maxY = Math.max(gap, window.innerHeight - miniSize.h - bottomSafe);
        setMiniPos({
          x: Math.min(maxX, Math.max(gap, origX + (e.clientX - startX))),
          y: Math.min(maxY, Math.max(gap, origY + (e.clientY - startY))),
          corner: null,
        });
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [mode, miniPos.x, miniPos.y, miniSize.w, miniSize.h, setMiniPos, setMiniPinned],
  );

  const pinParticipant = useCallback(
    (participantId, name) => {
      if (!participantId) return;
      try {
        executeCommand('pinParticipant', participantId);
        executeCommand('setLargeVideoParticipant', participantId);
        setPinnedParticipantId(participantId);
        toast({
          title: 'Основное видео',
          description: `Показан ${name || 'участник'}.`,
        });
      } catch {
        toast({
          title: 'Не удалось закрепить видео',
          description: 'Нажмите на миниатюру участника в окне конференции.',
        });
      }
    },
    [executeCommand],
  );

  const pipCloseRef = useRef(null);

  const focusOpenerWindow = useCallback(() => {
    try {
      window.focus();
    } catch {
      // ignore
    }
  }, []);

  const documentPip = useDocumentVideoPiP({
    active,
    enabled: isDesktop,
    jitsiHostRef,
    crmStageRef,
    audioMuted,
    videoMuted,
    screenSharing,
    chatUnread,
    participantCount,
    livePresence,
    pinnedParticipantId,
    isStudent: Boolean(session?.isStudent),
    title: session?.access?.lesson?.title || session?.subject || 'Видеоурок',
    onToggleAudio: () => executeCommand('toggleAudio'),
    onToggleVideo: () => executeCommand('toggleVideo'),
    onShareScreen: () => {
      focusOpenerWindow();
      setShareAudioHintOpen(true);
    },
    onOpenChat: () => {
      focusOpenerWindow();
      openStudyPanel('chat');
    },
    onOpenParticipants: () => {
      focusOpenerWindow();
      setRailTab('participants');
      setSheetOpen(true);
    },
    onReturnToLesson: () => {
      pipCloseRef.current?.({ reason: 'return' });
      expand();
    },
    onHangup: () => {
      focusOpenerWindow();
      requestEnd(endSession);
    },
    onPinParticipant: pinParticipant,
    onPipOpened: () => {
      enterPipMode(session?.backPath || undefined);
    },
    onPipClosed: ({ reason } = {}) => {
      if (reason === 'return' || reason === 'session_end' || reason === 'unmount') {
        return;
      }
      exitPipMode('mini');
    },
    resize,
  });

  pipCloseRef.current = documentPip.closeDocumentPiP;

  useLayoutEffect(() => {
    if (!active) return;
    const host = jitsiHostRef.current;
    const crmStage = crmStageRef.current;
    if (!host || !crmStage) return;
    if (!documentPip.pipOpen && host.parentElement !== crmStage) {
      crmStage.appendChild(host);
      try {
        resize();
      } catch {
        // ignore
      }
    }
  }, [active, mode, documentPip.pipOpen, resize]);

  const floatOverWindows = useCallback(async () => {
    if (!documentPip.supported) {
      minimize(session?.backPath);
      return false;
    }
    const ok = await documentPip.openDocumentPiP();
    if (!ok) {
      minimize(session?.backPath);
      return false;
    }
    return true;
  }, [documentPip, minimize, session?.backPath]);

  const minimizeSmart = useCallback(async () => {
    if (documentPip.supported) {
      await floatOverWindows();
      return;
    }
    minimize(session?.backPath);
  }, [documentPip.supported, floatOverWindows, minimize, session?.backPath]);

  const returnFromPip = useCallback(() => {
    documentPip.closeDocumentPiP({ reason: 'return' });
    expand();
  }, [documentPip, expand]);

  const completeLesson = useCallback(async () => {
    if (!session?.lessonId) return;
    setCompleteBusy(true);
    try {
      await api.lessons.update(session.lessonId, { status: 'completed' });
      toast({ title: 'Урок отмечен завершённым' });
    } catch (err) {
      toast({
        title: 'Не удалось сменить статус',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setCompleteBusy(false);
    }
  }, [session?.lessonId]);

  const handleScreenSharingChanged = useCallback(
    (on, meta) => {
      setScreenSharing(Boolean(on));
      if (on) {
        setShareLabel(shareLabelFromMeta(meta || {}));
        setShareStartedAt(Date.now());
      }
    },
    [setScreenSharing],
  );

  const changeShareSource = useCallback(() => {
    executeCommand('toggleShareScreen');
    window.setTimeout(() => setShareAudioHintOpen(true), 400);
  }, [executeCommand]);

  if (!active || !session) return null;

  const access = session.access || {};
  const lesson = access.lesson || {};
  const subject = access.subject || session.subject || 'Китайский язык';
  const timeRange =
    lesson.time_range_label ||
    `${formatClock(lesson.start_time)}${lesson.end_time ? ` – ${formatClock(lesson.end_time)}` : ''}`;
  const connectionLabel = videoConnectionMeta(connectionStatus).label;
  const canManageAttendance =
    user?.role === 'admin' ||
    user?.role === 'teacher' ||
    user?.role === 'tutor';
  const isMini = mode === 'mini';
  const isPip = mode === 'pip' || documentPip.pipOpen;
  const miniChromeH = 56;

  const sideRailProps = {
    lessonId: session.lessonId,
    lesson,
    isHost: session.isHost,
    isStudent: session.isStudent,
    materialsPath: session.materialsPath,
    homeworkPath: session.homeworkPath,
    activeTab: railTab === 'homework' || railTab === 'materials' ? railTab : 'chat',
    onActiveTabChange: setRailTab,
    onChatUnreadChange: setChatUnread,
    onChatToast: (payload) => setChatToast(payload),
    chatPanelVisible: sheetOpen && railTab === 'chat',
    onRequestNavigate: (path) => {
      setSheetOpen(false);
      if (documentPip.supported) {
        void documentPip.openDocumentPiP().then((ok) => {
          if (ok) enterPipMode(path);
          else minimize(path);
        });
        return;
      }
      minimize(path);
    },
  };

  const jitsiEmbed = (
    <JitsiLessonEmbed
      key={embedKey}
      ref={jitsiRef}
      domain={session.domain}
      roomName={session.roomName}
      roomUrl={session.roomUrl}
      displayName={session.displayName}
      subject={session.subject}
      externalApiUrl={session.externalApiUrl}
      jwt={session.jwt}
      crmUserId={session.crmUserId}
      crmEmail={session.crmEmail}
      crmTheme={theme === 'dark' ? 'dark' : 'light'}
      onLeft={() => endSession()}
      onJoined={() => setConnectionStatus('connected')}
      onError={(err) => {
        const transient = Boolean(err?.transient) || err?.fatal === false;
        if (transient) {
          videoDiagWarn('session_soft_error', {
            code: err?.code || null,
            message: err?.message || null,
            source: err?.source || null,
          });
          // Soft banner already via connectionStatus=reconnecting — do not kill the lesson.
          return;
        }
        const authLike =
          err?.code === 'missing_jwt' ||
          /token|jwt|unauthorized|auth/i.test(String(err?.message || err?.code || ''));
        if (authLike) {
          videoDiagWarn('session_auth_error_remount', {
            code: err?.code || null,
            message: err?.message || null,
          });
          toast({
            title: 'Обновляем доступ к уроку…',
            description: 'Переподключаемся с новым токеном.',
          });
          void refreshSessionToken({ remount: true }).then((ok) => {
            if (!ok) {
              toast({
                title: err?.title || 'Ошибка видеоурока',
                description: err?.message || 'Не удалось продолжить конференцию',
                variant: 'destructive',
              });
              endSession();
            }
          });
          return;
        }
        toast({
          title: err?.title || 'Ошибка видеоурока',
          description: err?.message || 'Не удалось продолжить конференцию',
          variant: 'destructive',
        });
        endSession();
      }}
      onAudioMuteChanged={setAudioMuted}
      onVideoMuteChanged={setVideoMuted}
      onConnectionStatus={setConnectionStatus}
      onParticipantCount={setParticipantCount}
      onPresenceChange={setLivePresence}
      onAudioUnlockNeeded={setAudioUnlockNeeded}
      onScreenSharingChanged={handleScreenSharingChanged}
      onLinkQualityChanged={(quality) => setLinkQuality(quality || 'unknown')}
    />
  );

  return (
    <>
      {/* Live Jitsi host lives in the CRM stage. Park is only a fallback
          reparent target when PiP closes and stage is momentarily gone. */}
      <div
        data-jitsi-park=""
        className="pointer-events-none fixed left-[-9999px] top-0 z-0 h-px w-px overflow-hidden opacity-0"
        aria-hidden
      />

      {isPip ? (
        <div
          className="fixed bottom-4 left-1/2 z-[96] flex max-w-[min(100vw-1.5rem,28rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur-md"
          data-testid="lesson-video-pip-crm-banner"
        >
          <PictureInPicture2 className="h-4 w-4 text-brand" aria-hidden />
          <span className="text-sm text-foreground">Видеоурок во всплывающем окне</span>
          <Button
            type="button"
            size="sm"
            className="min-h-9"
            data-testid="lesson-video-pip-banner-return"
            onClick={returnFromPip}
          >
            Вернуться в урок
          </Button>
        </div>
      ) : null}

      {/* Keep CRM shell mounted while Document PiP is open so the Jitsi host
          always has a same-document reparent target (no remount / reconnect). */}
      <div
        className={cn(
          'fixed z-[95] max-w-[100vw] overflow-x-hidden overflow-y-hidden bg-background text-foreground',
          isPip && 'pointer-events-none invisible h-0 w-0 overflow-hidden opacity-0',
          !isPip && isMini
            ? cn(
                'flex flex-col rounded-2xl border border-border shadow-2xl',
                dragging ? 'cursor-grabbing' : 'cursor-grab',
              )
            : !isPip
              ? 'inset-0 flex h-dvh max-h-dvh w-full flex-col'
              : null,
        )}
        style={
          !isPip && isMini
            ? {
                left: miniPos.x,
                top: miniPos.y,
                width: miniSize.w,
                height: miniSize.h + miniChromeH,
              }
            : undefined
        }
        data-testid={isMini && !isPip ? 'lesson-video-mini' : 'lesson-video-session-full'}
        data-theme={theme}
        aria-hidden={isPip}
        onPointerDown={!isPip && isMini ? onMiniDragStart : undefined}
      >
        {!isMini ? (
          <header className="z-20 grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 overflow-x-hidden border-b border-border bg-card/95 px-2 py-1.5 backdrop-blur-sm safe-pt sm:gap-3 sm:px-3">
            <button
              type="button"
              onClick={() => void minimizeSmart()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              aria-label={documentPip.supported ? 'Вынести видео поверх окон' : 'Свернуть урок'}
              data-testid="lesson-video-minimize"
            >
              {documentPip.supported ? (
                <PictureInPicture2 className="h-5 w-5" />
              ) : (
                <Minimize2 className="h-5 w-5" />
              )}
            </button>
            <div className="min-w-0 overflow-hidden">
              <p className="truncate text-sm font-semibold leading-tight">
                {lesson.title || 'Онлайн-урок'}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
                <span className="text-brand">{subject}</span>
                <span className="mx-1 opacity-40">·</span>
                <span>{lesson.teacher_name || 'Преподаватель'}</span>
                <span className="mx-1 opacity-40">·</span>
                <span className="tabular-nums">{timeRange}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              <ConnectionPill status={connectionStatus} />
              <LessonVideoLinkQuality quality={linkQuality} compact={!isDesktop} />
            </div>
          </header>
        ) : null}

        <section className={cn('relative min-h-0 min-w-0 flex-1 overflow-x-hidden', isMini && 'flex flex-col')}>
          <div
            ref={stageRef}
            className={cn(
              'relative min-w-0 max-w-full overflow-hidden bg-black',
              isMini ? 'w-full shrink-0' : 'absolute inset-0',
            )}
            style={isMini ? { height: miniSize.h } : undefined}
            data-testid="lesson-video-stage"
          >
            <div
              ref={crmStageRef}
              className="absolute inset-0"
              data-testid="lesson-video-crm-stage"
            >
              <div
                ref={jitsiHostRef}
                className="absolute inset-0 h-full w-full"
                data-testid="lesson-video-jitsi-host"
              >
                {jitsiEmbed}
              </div>
            </div>

            {audioUnlockNeeded && !isMini ? (
              <div
                className="absolute inset-x-0 bottom-16 z-30 flex justify-center px-3 sm:bottom-20"
                data-testid="lesson-video-audio-unlock"
              >
                <Button
                  type="button"
                  size="lg"
                  className="min-h-12 gap-2 rounded-2xl bg-brand px-5 text-brand-foreground shadow-xl"
                  onClick={() => {
                    void jitsiRef.current?.unlockRemoteAudio?.();
                    setAudioUnlockNeeded(false);
                  }}
                >
                  <Volume2 className="h-5 w-5" aria-hidden />
                  Нажмите, чтобы включить звук
                </Button>
              </div>
            ) : null}

            {!isMini ? (
              <LessonVideoFilmstrip
                visible={remoteOrLocalShare}
                participants={livePresence}
                pinnedId={pinnedParticipantId}
                compact={!isDesktop}
                onSelect={(id, name) => pinParticipant(id, name)}
                onPin={(id, name) => pinParticipant(id, name)}
              />
            ) : null}

            {isMini ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-2 py-1.5">
                <span className="truncate text-[11px] font-semibold text-white">
                  Видеоурок
                  {typeof participantCount === 'number' ? ` · ${participantCount}` : ''}
                </span>
                {screenSharing ? (
                  <span className="rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Экран
                  </span>
                ) : null}
              </div>
            ) : null}

            {!isMini &&
            (connectionStatus === 'reconnecting' ||
              connectionStatus === 'degraded' ||
              reconnectRestoredFlash) ? (
              <div className="pointer-events-none absolute left-1/2 top-3 z-30 max-w-[calc(100%-1.5rem)] -translate-x-1/2 truncate rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium shadow-lg">
                {reconnectRestoredFlash
                  ? 'Соединение успешно восстановлено.'
                  : connectionStatus === 'degraded'
                    ? 'Связь нестабильна. Урок продолжается.'
                    : 'Соединение потеряно. Пытаемся восстановить…'}
              </div>
            ) : null}

            {!isMini ? (
              <>
                <LessonVideoChatToast
                  notification={chatToast}
                  onOpenChat={() => {
                    openStudyPanel('chat');
                    setChatToast(null);
                  }}
                  onDismiss={() => setChatToast(null)}
                />
                <LessonVideoScreenShareBar
                  visible={remoteOrLocalShare}
                  shareLabel={shareLabel}
                  startedAt={shareStartedAt}
                  isLocalShare={screenSharing}
                  onStopShare={
                    screenSharing
                      ? () => executeCommand('toggleShareScreen')
                      : undefined
                  }
                  onChangeSource={screenSharing ? changeShareSource : undefined}
                />
                <LessonVideoSharePreview
                  visible={screenSharing}
                  shareLabel={shareLabel}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center overflow-x-hidden px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 sm:px-3">
                  <LessonVideoControls
                    audioMuted={audioMuted}
                    videoMuted={videoMuted}
                    screenSharing={screenSharing}
                    isStudent={session.isStudent}
                    chatUnread={chatUnread}
                    participantCount={participantCount}
                    lessonId={session.lessonId}
                    livePresence={livePresence}
                    onPinParticipant={pinParticipant}
                    participantsOpen={participantsOpen}
                    onParticipantsOpenChange={setParticipantsOpen}
                    onToggleAudio={() => executeCommand('toggleAudio')}
                    onToggleVideo={() => executeCommand('toggleVideo')}
                    onShareScreen={() => setShareAudioHintOpen(true)}
                    onHangup={() => requestEnd(endSession)}
                    onOpenChat={() => openStudyPanel('chat')}
                    onOpenMaterials={() => openStudyPanel('materials')}
                    onMinimize={() => void minimizeSmart()}
                    documentPipSupported={documentPip.supported}
                    onFloatOverWindows={
                      documentPip.supported
                        ? () => void floatOverWindows()
                        : undefined
                    }
                    onRaiseHand={
                      session.isStudent
                        ? () => {
                            toast({
                              title: 'Рука поднята',
                              description: 'Преподаватель увидит ваш сигнал.',
                            });
                            executeCommand('toggleRaiseHand');
                          }
                        : undefined
                    }
                    onOpenSettings={() => setSettingsOpen(true)}
                  />
                </div>
              </>
            ) : null}
          </div>

          {isMini ? (
            <div
              className="flex max-w-full flex-wrap items-center justify-center gap-1 overflow-x-hidden border-t border-border bg-card px-1 py-1"
              data-mini-action
              data-testid="lesson-video-mini-controls"
            >
              <Button
                type="button"
                size="icon"
                variant={audioMuted ? 'destructive' : 'outline'}
                className="h-8 w-8 min-h-8 min-w-8"
                aria-label="Микрофон"
                onClick={() => executeCommand('toggleAudio')}
              >
                {audioMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant={videoMuted ? 'destructive' : 'outline'}
                className="h-8 w-8 min-h-8 min-w-8"
                aria-label="Камера"
                onClick={() => executeCommand('toggleVideo')}
              >
                {videoMuted ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant={screenSharing ? 'secondary' : 'outline'}
                className="h-8 w-8 min-h-8 min-w-8"
                aria-label="Демонстрация экрана"
                onClick={() => setShareAudioHintOpen(true)}
              >
                <MonitorUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="relative h-8 w-8 min-h-8 min-w-8"
                aria-label="Чат"
                data-testid="lesson-video-mini-chat"
                onClick={() => openStudyPanel('chat')}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {chatUnread > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-brand text-[8px] text-white">
                    {chatUnread > 9 ? '9+' : chatUnread}
                  </span>
                ) : null}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 min-h-8 min-w-8"
                aria-label="Участники"
                data-testid="lesson-video-mini-people"
                onClick={() => {
                  setRailTab('participants');
                  setSheetOpen(true);
                }}
              >
                <Users className="h-3.5 w-3.5" />
              </Button>
              {documentPip.supported ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 min-h-8 min-w-8"
                  aria-label="Вынести видео поверх окон"
                  data-testid="lesson-video-mini-float"
                  onClick={() => void floatOverWindows()}
                >
                  <PictureInPicture2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 min-h-8 min-w-8"
                aria-label="Развернуть"
                onClick={() => expand()}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={miniPinned ? 'secondary' : 'ghost'}
                className="h-8 w-8 min-h-8 min-w-8"
                aria-label="Закрепить угол"
                onClick={() => {
                  const next =
                    CORNERS[
                      (CORNERS.indexOf(miniPos.corner || 'bottom-right') + 1) %
                        CORNERS.length
                    ];
                  pinMiniCorner(next);
                }}
              >
                <Pin className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="h-8 w-8 min-h-8 min-w-8"
                aria-label="Завершить урок"
                onClick={() => requestEnd(endSession)}
              >
                <PhoneOff className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </section>
      </div>

      {/* Study drawer: chat / materials / homework — never a permanent rail */}
      <Sheet
        open={sheetOpen && railTab !== 'participants'}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open && railTab === 'participants') setRailTab('chat');
        }}
      >
        <SheetContent
          side={isDesktop && !isMini ? 'right' : 'bottom'}
          className={cn(
            'z-[110] flex flex-col gap-0 overflow-x-hidden border-border bg-card p-0',
            isDesktop && !isMini
              ? 'h-full w-full max-w-[min(100vw,22rem)] sm:max-w-[22rem]'
              : 'h-[min(85dvh,100%)] max-h-[85dvh] w-full max-w-[100vw] rounded-t-2xl safe-pb',
          )}
        >
          {!(isDesktop && !isMini) ? (
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          ) : null}
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-12">
            <SheetTitle className="text-left text-base">
              {railTab === 'materials'
                ? 'Материалы'
                : railTab === 'homework'
                  ? 'Домашние задания'
                  : 'Чат урока'}
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <LessonVideoSideRail {...sideRailProps} compact />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mini-mode participants sheet */}
      <Sheet
        open={sheetOpen && railTab === 'participants'}
        onOpenChange={(open) => {
          if (!open) {
            setSheetOpen(false);
            setRailTab('chat');
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="z-[110] flex h-[min(70dvh,100%)] max-h-[70dvh] w-full max-w-[100vw] flex-col gap-0 overflow-x-hidden rounded-t-2xl border-border bg-card p-0 safe-pb"
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-12">
            <SheetTitle className="text-left text-base">Участники</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden p-3">
            <LessonVideoParticipantsPanel
              lessonId={session.lessonId}
              livePresence={livePresence}
              jitsiParticipantCount={participantCount}
              onPinParticipant={pinParticipant}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-[min(100vw-1.5rem,24rem)] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Настройки урока</DialogTitle>
            <DialogDescription>
              Устройства и служебные действия. Посещаемость и информация об уроке
              открываются отдельно и не занимают экран постоянно.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-11 justify-start"
              onClick={async () => {
                try {
                  const result = await checkMediaDevices();
                  toast({
                    title: 'Устройства',
                    description: `${result.camera.ok ? 'камера ок' : 'камера недоступна'}, ${result.microphone.ok ? 'микрофон ок' : 'микрофон недоступен'}.`,
                  });
                } catch {
                  toast({
                    title: 'Устройства',
                    description: 'Проверьте разрешения камеры и микрофона.',
                  });
                }
              }}
            >
              Проверить камеру и микрофон
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-11 justify-start"
              onClick={() => {
                setSettingsOpen(false);
                setInfoOpen(true);
              }}
            >
              <Info className="mr-2 h-4 w-4" />
              Информация об уроке
            </Button>
            {canManageAttendance ? (
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-11 justify-start"
                data-testid="lesson-video-open-attendance"
                onClick={() => {
                  setSettingsOpen(false);
                  setAttendanceOpen(true);
                }}
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Посещаемость
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-[min(100vw-1.5rem,26rem)] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Информация об уроке</DialogTitle>
          </DialogHeader>
          <LessonVideoInfoPanel
            lesson={lesson}
            subject={subject}
            timeRange={timeRange}
            connectionLabel={connectionLabel}
            isHost={session.isHost}
            homeworkPath={session.homeworkPath}
            onRequestNavigate={(path) => {
              setInfoOpen(false);
              if (documentPip.supported) {
                void documentPip.openDocumentPiP().then((ok) => {
                  if (ok) enterPipMode(path);
                  else minimize(path);
                });
                return;
              }
              minimize(path);
            }}
            onCompleteLesson={() => void completeLesson()}
            completeBusy={completeBusy}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <DialogContent className="max-w-[min(100vw-1.5rem,28rem)] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Посещаемость</DialogTitle>
            <DialogDescription>
              Отметка не прерывает видеозвонок.
            </DialogDescription>
          </DialogHeader>
          <LessonVideoAttendancePanel
            lessonId={session.lessonId}
            livePresence={livePresence}
          />
        </DialogContent>
      </Dialog>

      <LessonVideoLeaveDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        onStay={() => setLeaveOpen(false)}
        onLeave={confirmLeave}
      />

      <VideoScreenShareAudioHint
        open={shareAudioHintOpen}
        onOpenChange={setShareAudioHintOpen}
        onContinue={() => executeCommand('toggleShareScreen')}
      />
    </>
  );
}
