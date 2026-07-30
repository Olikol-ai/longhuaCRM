import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  checkMediaDevices,
  parseJitsiDomain,
  videoConnectionMeta,
} from '@/lib/lesson-video';
import { useIsLgUp, useIsMdUp } from '@/lib/responsive';
import { cn } from '@/lib/utils';
import JitsiLessonEmbed from '@/components/video/JitsiLessonEmbed';
import VideoPrejoin from '@/components/video/VideoPrejoin';
import LessonVideoControls from '@/components/video/LessonVideoControls';
import LessonVideoSideRail from '@/components/video/LessonVideoSideRail';

function formatClock(t) {
  if (!t) return '—';
  return String(t).slice(0, 5);
}

function ConnectionPill({ status }) {
  const meta = videoConnectionMeta(status);
  const tone =
    meta.tone === 'ok'
      ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
      : meta.tone === 'warn'
        ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
        : meta.tone === 'bad'
          ? 'bg-rose-500/15 text-rose-300 ring-rose-500/30'
          : 'bg-slate-800 text-slate-400 ring-slate-700';
  const dot =
    meta.tone === 'ok'
      ? 'bg-emerald-400'
      : meta.tone === 'warn'
        ? 'bg-amber-400 animate-pulse'
        : meta.tone === 'bad'
          ? 'bg-rose-400'
          : 'bg-slate-500';

  return (
    <span
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium ring-1',
        tone,
      )}
      data-testid="lesson-video-connection"
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export default function LessonVideo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMdUp = useIsMdUp();
  const isLgUp = useIsLgUp();
  const jitsiRef = useRef(null);
  const stageRef = useRef(null);
  const conferenceJoinedRef = useRef(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forceJoin, setForceJoin] = useState(false);
  const [joined, setJoined] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [desktopRailOpen, setDesktopRailOpen] = useState(true);
  const [embedKey, setEmbedKey] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [jitsiParticipantCount, setJitsiParticipantCount] = useState(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.video.getLessonAccess(id);
        setData(res);
      } catch (err) {
        toast({
          title: 'Не удалось открыть видеоурок',
          description: userFacingError(err),
          variant: 'destructive',
        });
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const prepareJoin = useCallback(async () => {
    if (!id) return null;
    try {
      const res = await api.video.refreshToken(id);
      if (res) {
        setData(res);
        return res;
      }
    } catch (err) {
      throw err;
    }
    return data;
  }, [id, data]);

  const runDeviceCheck = useCallback(async () => {
    setChecking(true);
    try {
      const result = await checkMediaDevices();
      setChecks(result);
    } catch {
      setChecks({
        camera: { ok: false, label: 'Камера' },
        microphone: { ok: false, label: 'Микрофон' },
        network: {
          ok: typeof navigator !== 'undefined' && navigator.onLine !== false,
          label: 'Интернет',
        },
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && data) {
      void runDeviceCheck();
    }
  }, [loading, data, runDeviceCheck]);

  // Close mobile/tablet sheet when switching to desktop rail.
  useEffect(() => {
    if (isLgUp) setSheetOpen(false);
  }, [isLgUp]);

  const canJoinWindow = forceJoin || Boolean(data?.timing?.can_join);
  const phase = data?.timing?.phase;
  const tooEarly = phase === 'before' && !canJoinWindow;
  const isHost = Boolean(data?.is_host);
  const isStudent = data?.viewer_role === 'student';

  const backPath = useMemo(() => {
    if (user?.role === 'student' || user?.role === 'tutor_student') {
      return createPageUrl('StudentLessons');
    }
    if (user?.role === 'teacher') return createPageUrl('TeacherSchedule');
    if (user?.role === 'tutor') return createPageUrl('TutorSchedule');
    return createPageUrl('Dashboard');
  }, [user?.role]);

  const materialsPath = useMemo(() => {
    if (isStudent) return createPageUrl('StudentLessonMaterials');
    return createPageUrl('MaterialsHub');
  }, [isStudent]);

  const homeworkPath = useMemo(() => {
    if (isStudent) return createPageUrl('HomeworkViewer');
    return createPageUrl('HomeworkList');
  }, [isStudent]);

  const joinLabel = isHost ? 'Начать урок' : 'Войти в урок';

  const enterConference = useCallback(async () => {
    setJoining(true);
    setJoinError(null);
    setSessionEnded(false);
    setConnectionStatus('connecting');
    conferenceJoinedRef.current = false;
    try {
      const access = await prepareJoin();
      const token = access?.token || data?.token;
      const room = access?.room_name || access?.room_id || data?.room_name || data?.room_id;
      const host = access?.domain || data?.domain || parseJitsiDomain(access?.room_url || data?.room_url);
      if (!token || !room || !host) {
        setJoinError('Не удалось получить доступ к видеоконференции. Обновите страницу и попробуйте снова.');
        setJoined(false);
        setConnectionStatus('failed');
        return;
      }
      setForceJoin(true);
      setEmbedKey((k) => k + 1);
      setJoined(true);
    } catch (err) {
      setJoinError(userFacingError(err) || 'Не удалось подключиться к видеоконференции.');
      setJoined(false);
      setConnectionStatus('failed');
    } finally {
      setJoining(false);
    }
  }, [prepareJoin, data]);

  const handleJoin = useCallback(async () => {
    if (tooEarly && !isHost) return;
    await enterConference();
  }, [tooEarly, isHost, enterConference]);

  const handleForceJoin = useCallback(async () => {
    await enterConference();
  }, [enterConference]);

  const handleLeft = useCallback(() => {
    if (!conferenceJoinedRef.current) return;
    setJoined(false);
    setSessionEnded(true);
    setJoinError(null);
    setConnectionStatus('idle');
    setJitsiParticipantCount(null);
  }, []);

  const handleJoined = useCallback(() => {
    conferenceJoinedRef.current = true;
    setSessionEnded(false);
    setJoinError(null);
    setConnectionStatus('connected');
  }, []);

  const handleEmbedError = useCallback((err) => {
    const message =
      userFacingError(err) || 'Не удалось подключиться к видеоконференции.';
    setJoinError(message);
    setJoined(false);
    setSessionEnded(false);
    setConnectionStatus('failed');
  }, []);

  const hangup = useCallback(() => {
    conferenceJoinedRef.current = true;
    jitsiRef.current?.executeCommand?.('hangup');
    setJoined(false);
    setSessionEnded(true);
    setJoinError(null);
    setConnectionStatus('idle');
  }, []);

  const openPanel = useCallback(() => {
    if (isLgUp) {
      setDesktopRailOpen(true);
    } else {
      setSheetOpen(true);
    }
  }, [isLgUp]);

  if (loading) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-950 text-slate-100"
        data-testid="lesson-video-page-loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium">Загрузка урока…</p>
        <p className="text-xs text-slate-500">Longhua · видеоурок</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-slate-100">
        <p className="text-slate-300">Видеоурок недоступен</p>
        <Button variant="outline" className="min-h-11 border-slate-700" onClick={() => navigate(backPath)}>
          Назад
        </Button>
      </div>
    );
  }

  const lesson = data.lesson || {};
  const subject = data.subject || 'Китайский язык';
  const timeRange =
    lesson.time_range_label ||
    `${formatClock(lesson.start_time)}${lesson.end_time ? ` – ${formatClock(lesson.end_time)}` : ''}`;
  const domain = data.domain || parseJitsiDomain(data.room_url);
  const showVideo = joined && canJoinWindow && Boolean(data.token);
  const connectionLabel = videoConnectionMeta(showVideo || joining ? connectionStatus : 'idle').label;

  const sideRailProps = {
    lessonId: id,
    lesson,
    isHost,
    isStudent,
    materialsPath,
    homeworkPath,
    jitsiParticipantCount,
    timeRange,
    subject,
    connectionLabel,
  };

  return (
    <div
      className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-slate-950 text-slate-100"
      data-testid="lesson-video-page"
    >
      {/* Top bar */}
      <header className="z-20 flex shrink-0 items-center gap-2 border-b border-slate-800/80 bg-slate-950/95 px-3 py-2 sm:px-4 safe-pt">
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-900 hover:text-slate-100"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="truncate text-sm font-semibold tracking-tight text-brand sm:text-base">
              Longhua
            </p>
            <span className="hidden text-slate-600 sm:inline">·</span>
            <p className="truncate text-sm font-medium text-slate-100">
              {lesson.title || 'Онлайн-урок'}
            </p>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400 sm:text-xs">
            <span className="truncate">{subject}</span>
            <span className="text-slate-600">·</span>
            <span className="truncate">{lesson.teacher_name || 'Преподаватель'}</span>
            <span className="text-slate-600">·</span>
            <span className="tabular-nums">{timeRange}</span>
            {lesson.duration ? (
              <>
                <span className="hidden text-slate-600 sm:inline">·</span>
                <span className="hidden sm:inline">{lesson.duration} мин</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showVideo || joining ? <ConnectionPill status={connectionStatus} /> : null}
          {isHost && showVideo ? (
            <span className="hidden items-center gap-1.5 text-[11px] text-emerald-400 md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Вы проводите урок
            </span>
          ) : null}
          {phase === 'after' && !showVideo ? (
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-400">
              Урок завершён
            </span>
          ) : null}

          {isLgUp ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-11 min-w-11 px-2 text-slate-300"
              onClick={() => setDesktopRailOpen((v) => !v)}
              aria-label={desktopRailOpen ? 'Скрыть панель' : 'Показать панель'}
            >
              {desktopRailOpen ? (
                <PanelRightClose className="h-5 w-5" />
              ) : (
                <PanelRightOpen className="h-5 w-5" />
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 border-slate-700 px-3"
              onClick={() => setSheetOpen(true)}
            >
              <PanelRightOpen className="mr-1.5 h-4 w-4" />
              <span className="hidden xs:inline sm:inline">Панель</span>
            </Button>
          )}
        </div>
      </header>

      {/* Main stage */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <section
          className={cn(
            'relative flex min-h-0 min-w-0 flex-1 flex-col',
            showVideo ? 'bg-black' : 'bg-slate-950',
          )}
        >
          {showVideo ? (
            <>
              <div
                ref={stageRef}
                className="relative min-h-0 w-full flex-1 overflow-hidden bg-black"
              >
                <JitsiLessonEmbed
                  key={embedKey}
                  ref={jitsiRef}
                  domain={domain}
                  roomName={data.room_name || data.room_id}
                  roomUrl={data.room_url}
                  displayName={data.display_name}
                  subject={data.conference_subject || lesson.title}
                  externalApiUrl={data.external_api_url}
                  jwt={data.token}
                  onLeft={handleLeft}
                  onJoined={handleJoined}
                  onError={handleEmbedError}
                  onAudioMuteChanged={setAudioMuted}
                  onVideoMuteChanged={setVideoMuted}
                  onConnectionStatus={setConnectionStatus}
                  onParticipantCount={setJitsiParticipantCount}
                />
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-16 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                <div className="pointer-events-auto w-full max-w-xl">
                  <LessonVideoControls
                    floating
                    audioMuted={audioMuted}
                    videoMuted={videoMuted}
                    onToggleAudio={() => jitsiRef.current?.executeCommand?.('toggleAudio')}
                    onToggleVideo={() => jitsiRef.current?.executeCommand?.('toggleVideo')}
                    onShareScreen={() => jitsiRef.current?.executeCommand?.('toggleShareScreen')}
                    onFullscreen={() => {
                      const el = stageRef.current;
                      if (!el) return;
                      if (document.fullscreenElement) {
                        void document.exitFullscreen?.();
                      } else {
                        void el.requestFullscreen?.();
                      }
                    }}
                    onHangup={hangup}
                    showPanelButton={!isLgUp}
                    onOpenPanel={openPanel}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
              <div className="w-full max-w-lg">
                {joinError ? (
                  <div
                    className="space-y-4 rounded-2xl border border-rose-900/60 bg-slate-900 p-6 text-center sm:p-8"
                    data-testid="lesson-video-join-error"
                  >
                    <p className="font-medium text-rose-300">
                      Не удалось подключиться к видеоконференции.
                    </p>
                    <p className="text-sm text-slate-400">{joinError}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        type="button"
                        className="min-h-11"
                        onClick={enterConference}
                        disabled={joining}
                        data-testid="lesson-video-retry"
                      >
                        {joining ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Подключение…
                          </>
                        ) : (
                          'Повторить'
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 border-slate-700"
                        onClick={() => navigate(backPath)}
                      >
                        Назад
                      </Button>
                    </div>
                  </div>
                ) : sessionEnded ? (
                  <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center sm:p-8">
                    <p className="font-medium">Вы вышли из урока</p>
                    <p className="text-sm text-slate-400">
                      Можно вернуться в видео или открыть материалы, чат и ДЗ в панели урока.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        type="button"
                        className="min-h-11"
                        onClick={handleJoin}
                        data-testid="lesson-video-rejoin"
                      >
                        {isHost ? 'Вернуться в урок' : 'Войти в урок снова'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 border-slate-700"
                        onClick={openPanel}
                      >
                        Панель урока
                      </Button>
                    </div>
                  </div>
                ) : (
                  <VideoPrejoin
                    isHost={isHost}
                    checking={checking || joining}
                    checks={checks}
                    canJoin={canJoinWindow}
                    tooEarly={tooEarly}
                    minutesUntilStart={data.timing?.minutes_until_start}
                    hostRequiresAccount={Boolean(data.host_requires_account)}
                    onCheck={runDeviceCheck}
                    onJoin={handleJoin}
                    onForceJoin={handleForceJoin}
                    joinLabel={joinLabel}
                  />
                )}
              </div>
            </div>
          )}
        </section>

        {/* Desktop rail (≥1024) */}
        {isLgUp && desktopRailOpen ? (
          <div
            className="hidden h-full w-[min(400px,36vw)] min-w-[320px] max-w-[400px] shrink-0 border-l border-slate-800 bg-slate-950 p-3 lg:block"
            data-testid="lesson-video-desktop-rail"
          >
            <LessonVideoSideRail {...sideRailProps} />
          </div>
        ) : null}
      </div>

      {/* Tablet / mobile: drawer or bottom sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side={isMdUp ? 'right' : 'bottom'}
          className={
            isMdUp
              ? 'w-full border-slate-800 bg-slate-950 p-0 text-slate-100 sm:max-w-md'
              : 'h-[min(88dvh,100%)] max-h-[88dvh] w-full rounded-t-2xl border-slate-800 bg-slate-950 p-0 text-slate-100 safe-pb'
          }
        >
          {!isMdUp ? (
            <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-slate-700" aria-hidden />
          ) : null}
          <SheetHeader className="border-b border-slate-800 p-4 pb-3">
            <SheetTitle className="text-slate-100">Панель урока</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-3.75rem)] overflow-hidden p-2">
            <LessonVideoSideRail {...sideRailProps} compact />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
