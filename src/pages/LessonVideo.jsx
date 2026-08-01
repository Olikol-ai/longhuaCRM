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
import { useTheme } from '@/lib/ThemeContext';
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isMdUp = useIsMdUp();
  const isLgUp = useIsLgUp();
  const jitsiRef = useRef(null);
  const stageRef = useRef(null);
  const conferenceJoinedRef = useRef(false);
  const sessionJwtRef = useRef(null);

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
  /** Bump only when intentionally remounting after hangup / hard error — not on token refresh. */
  const [embedKey, setEmbedKey] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [jitsiParticipantCount, setJitsiParticipantCount] = useState(null);
  /** JWT frozen for the current embed session (avoids remount when access payload refreshes). */
  const [sessionJwt, setSessionJwt] = useState(null);

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

  // Side panel open/close must only resize the iframe — never remount Jitsi.
  useEffect(() => {
    if (!joined) return undefined;
    const id = window.requestAnimationFrame(() => {
      jitsiRef.current?.resize?.();
    });
    const t = window.setTimeout(() => jitsiRef.current?.resize?.(), 200);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [joined, desktopRailOpen, sheetOpen, isLgUp]);

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
      // New session JWT only when (re)starting embed — not on every access payload refresh.
      sessionJwtRef.current = token;
      setSessionJwt(token);
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
    sessionJwtRef.current = null;
    setSessionJwt(null);
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
    sessionJwtRef.current = null;
    setSessionJwt(null);
    // Next retry gets a fresh embed instance.
    setEmbedKey((k) => k + 1);
  }, []);

  const hangup = useCallback(() => {
    conferenceJoinedRef.current = true;
    jitsiRef.current?.executeCommand?.('hangup');
    setJoined(false);
    setSessionEnded(true);
    setJoinError(null);
    setConnectionStatus('idle');
    sessionJwtRef.current = null;
    setSessionJwt(null);
    setEmbedKey((k) => k + 1);
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
        className={cn(
          'flex min-h-dvh flex-col items-center justify-center gap-3',
          isDark ? 'bg-slate-950 text-slate-100' : 'bg-background text-foreground',
        )}
        data-testid="lesson-video-page-loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium">Загрузка урока…</p>
        <p className={cn('text-xs', isDark ? 'text-slate-500' : 'text-muted-foreground')}>
          Longhua · видеоурок
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className={cn(
          'flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center',
          isDark ? 'bg-slate-950 text-slate-100' : 'bg-background text-foreground',
        )}
      >
        <p className={isDark ? 'text-slate-300' : 'text-muted-foreground'}>Видеоурок недоступен</p>
        <Button variant="outline" className="min-h-11" onClick={() => navigate(backPath)}>
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
  const embedJwt = sessionJwt || sessionJwtRef.current;
  const showVideo = joined && canJoinWindow && Boolean(embedJwt);
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
      className={cn(
        'flex h-dvh max-h-dvh flex-col overflow-hidden',
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-background text-foreground',
      )}
      data-testid="lesson-video-page"
      data-theme={theme}
    >
      {/* Top bar — follows CRM theme; does not force html.dark */}
      <header
        className={cn(
          'z-20 flex shrink-0 items-center gap-2 border-b px-3 py-2 sm:px-4 safe-pt',
          isDark
            ? 'border-slate-800/80 bg-slate-950/95'
            : 'border-border bg-card/95',
        )}
      >
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className={cn(
            'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl',
            isDark
              ? 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="truncate text-sm font-semibold tracking-tight text-brand sm:text-base">
              Longhua
            </p>
            <span className={cn('hidden sm:inline', isDark ? 'text-slate-600' : 'text-muted-foreground/50')}>·</span>
            <p className={cn('truncate text-sm font-medium', isDark ? 'text-slate-100' : 'text-foreground')}>
              {lesson.title || 'Онлайн-урок'}
            </p>
          </div>
          <div
            className={cn(
              'mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs',
              isDark ? 'text-slate-400' : 'text-muted-foreground',
            )}
          >
            <span className="truncate">{subject}</span>
            <span className={isDark ? 'text-slate-600' : 'text-muted-foreground/40'}>·</span>
            <span className="truncate">{lesson.teacher_name || 'Преподаватель'}</span>
            <span className={isDark ? 'text-slate-600' : 'text-muted-foreground/40'}>·</span>
            <span className="tabular-nums">{timeRange}</span>
            {lesson.duration ? (
              <>
                <span className={cn('hidden sm:inline', isDark ? 'text-slate-600' : 'text-muted-foreground/40')}>·</span>
                <span className="hidden sm:inline">{lesson.duration} мин</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showVideo || joining ? <ConnectionPill status={connectionStatus} /> : null}
          {isHost && showVideo ? (
            <span className="hidden items-center gap-1.5 text-[11px] text-emerald-500 md:inline-flex dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Вы проводите урок
            </span>
          ) : null}
          {phase === 'after' && !showVideo ? (
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px]',
                isDark ? 'bg-slate-800 text-slate-400' : 'bg-muted text-muted-foreground',
              )}
            >
              Урок завершён
            </span>
          ) : null}

          {isLgUp ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn('min-h-11 min-w-11 px-2', isDark ? 'text-slate-300' : '')}
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
              className={cn('min-h-11 px-3', isDark ? 'border-slate-700' : '')}
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
            showVideo ? 'bg-neutral-950' : isDark ? 'bg-slate-950' : 'bg-muted/30',
          )}
        >
          {showVideo ? (
            <>
              <div
                ref={stageRef}
                className="relative min-h-0 w-full flex-1 overflow-hidden bg-neutral-950"
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
                  jwt={embedJwt}
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
            className={cn(
              'hidden h-full w-[min(400px,36vw)] min-w-[320px] max-w-[400px] shrink-0 border-l p-3 lg:block',
              isDark ? 'border-slate-800 bg-slate-950' : 'border-border bg-card',
            )}
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
              ? cn(
                  'w-full p-0 sm:max-w-md',
                  isDark
                    ? 'border-slate-800 bg-slate-950 text-slate-100'
                    : 'border-border bg-card text-foreground',
                )
              : cn(
                  'h-[min(88dvh,100%)] max-h-[88dvh] w-full rounded-t-2xl p-0 safe-pb',
                  isDark
                    ? 'border-slate-800 bg-slate-950 text-slate-100'
                    : 'border-border bg-card text-foreground',
                )
          }
        >
          {!isMdUp ? (
            <div
              className={cn(
                'mx-auto mt-2 mb-1 h-1 w-10 rounded-full',
                isDark ? 'bg-slate-700' : 'bg-muted-foreground/30',
              )}
              aria-hidden
            />
          ) : null}
          <SheetHeader className={cn('border-b p-4 pb-3', isDark ? 'border-slate-800' : 'border-border')}>
            <SheetTitle className={isDark ? 'text-slate-100' : 'text-foreground'}>
              Панель урока
            </SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-3.75rem)] overflow-hidden p-2">
            <LessonVideoSideRail {...sideRailProps} compact />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
