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
import { useIsLgUp } from '@/lib/responsive';
import { cn } from '@/lib/utils';
import JitsiLessonEmbed from '@/components/video/JitsiLessonEmbed';
import VideoPrejoin from '@/components/video/VideoPrejoin';
import LessonVideoControls from '@/components/video/LessonVideoControls';
import LessonVideoSideRail from '@/components/video/LessonVideoSideRail';

/** Fixed desktop rail width (~15–20% of common desktops, never squeezes video). */
const DESKTOP_RAIL_WIDTH = 'min(20vw, 22rem)';

function formatClock(t) {
  if (!t) return '—';
  return String(t).slice(0, 5);
}

function ConnectionPill({ status, isDark }) {
  const meta = videoConnectionMeta(status);
  const tone =
    meta.tone === 'ok'
      ? isDark
        ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
        : 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25'
      : meta.tone === 'warn'
        ? isDark
          ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
          : 'bg-amber-500/10 text-amber-800 ring-amber-500/25'
        : meta.tone === 'bad'
          ? isDark
            ? 'bg-rose-500/15 text-rose-300 ring-rose-500/30'
            : 'bg-rose-500/10 text-rose-700 ring-rose-500/25'
          : isDark
            ? 'bg-white/5 text-slate-400 ring-white/10'
            : 'bg-muted text-muted-foreground ring-border';
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

export default function LessonVideo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isDesktop = useIsLgUp();
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
  const [railTab, setRailTab] = useState('chat');
  const [embedKey, setEmbedKey] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [jitsiParticipantCount, setJitsiParticipantCount] = useState(null);
  const [livePresence, setLivePresence] = useState([]);
  const [sessionJwt, setSessionJwt] = useState(null);
  const [lessonChatUnread, setLessonChatUnread] = useState(0);

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

  useEffect(() => {
    if (isDesktop) setSheetOpen(false);
  }, [isDesktop]);

  // Side panel open/close must only resize the iframe — never remount Jitsi.
  useEffect(() => {
    if (!joined) return undefined;
    const frame = window.requestAnimationFrame(() => {
      jitsiRef.current?.resize?.();
    });
    const t = window.setTimeout(() => jitsiRef.current?.resize?.(), 280);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(t);
    };
  }, [joined, desktopRailOpen, sheetOpen, isDesktop]);

  const canJoinWindow = forceJoin || Boolean(data?.timing?.can_join);
  const phase = data?.timing?.phase;
  const tooEarly = phase === 'before' && !canJoinWindow;
  const isHost = Boolean(data?.is_host);
  const isStudent = data?.viewer_role === 'student';
  const canManageAttendance =
    user?.role === 'admin' ||
    user?.role === 'teacher' ||
    user?.role === 'tutor';

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

  const openSheetTab = useCallback((tabId) => {
    setRailTab(tabId || 'chat');
    if (isDesktop) {
      setDesktopRailOpen(true);
    } else {
      setSheetOpen(true);
    }
  }, [isDesktop]);

  const openPanel = useCallback(() => {
    openSheetTab(railTab || 'chat');
  }, [openSheetTab, railTab]);

  if (loading) {
    return (
      <div
        className={cn(
          'flex min-h-dvh flex-col items-center justify-center gap-3',
          isDark ? 'bg-neutral-950 text-slate-100' : 'bg-background text-foreground',
        )}
        data-testid="lesson-video-page-loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium">Загрузка урока…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className={cn(
          'flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center',
          isDark ? 'bg-neutral-950 text-slate-100' : 'bg-background text-foreground',
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
  const desktopRailVisible = isDesktop && desktopRailOpen;

  const sideRailProps = {
    lessonId: id,
    lesson,
    isHost,
    isStudent,
    canManageAttendance,
    materialsPath,
    homeworkPath,
    jitsiParticipantCount,
    livePresence,
    timeRange,
    subject,
    connectionLabel,
    activeTab: railTab,
    onActiveTabChange: setRailTab,
    onChatUnreadChange: setLessonChatUnread,
  };

  return (
    <div
      className={cn(
        'grid h-dvh max-h-dvh w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden',
        isDark ? 'bg-neutral-950 text-slate-100' : 'bg-background text-foreground',
      )}
      data-testid="lesson-video-page"
      data-theme={theme}
    >
      {/* Compact top bar */}
      <header
        className={cn(
          'z-20 grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b px-2 py-1.5 sm:gap-3 sm:px-3 safe-pt',
          isDark
            ? 'border-white/10 bg-neutral-950/95'
            : 'border-border bg-card/95',
        )}
      >
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-full',
            isDark
              ? 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <p className={cn('truncate text-sm font-semibold leading-tight', isDark ? 'text-slate-50' : 'text-foreground')}>
            {lesson.title || 'Онлайн-урок'}
          </p>
          <p
            className={cn(
              'mt-0.5 truncate text-[11px] leading-tight sm:text-xs',
              isDark ? 'text-slate-400' : 'text-muted-foreground',
            )}
          >
            <span className="text-brand">{subject}</span>
            <span className="mx-1 opacity-40">·</span>
            <span>{lesson.teacher_name || 'Преподаватель'}</span>
            <span className="mx-1 opacity-40">·</span>
            <span className="tabular-nums">{timeRange}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {showVideo || joining ? <ConnectionPill status={connectionStatus} isDark={isDark} /> : null}

          {isDesktop ? (
            <button
              type="button"
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                isDark
                  ? 'text-slate-300 hover:bg-white/5'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => setDesktopRailOpen((v) => !v)}
              aria-label={desktopRailOpen ? 'Скрыть панель' : 'Показать панель'}
              aria-pressed={desktopRailOpen}
              data-testid="lesson-video-rail-toggle"
            >
              {desktopRailOpen ? (
                <PanelRightClose className="h-5 w-5" />
              ) : (
                <PanelRightOpen className="h-5 w-5" />
              )}
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium',
                isDark
                  ? 'bg-white/5 text-slate-200 hover:bg-white/10'
                  : 'bg-muted text-foreground hover:bg-muted/80',
              )}
              onClick={() => openSheetTab('chat')}
              data-testid="lesson-video-open-sheet"
            >
              <PanelRightOpen className="h-4 w-4" />
              <span className="hidden min-[360px]:inline">Панель</span>
            </button>
          )}
        </div>
      </header>

      {/* Stage + optional desktop rail */}
      <div
        className={cn(
          'grid min-h-0 min-w-0 overflow-hidden transition-[grid-template-columns] duration-300 ease-out',
          desktopRailVisible
            ? 'grid-cols-[minmax(0,1fr)_var(--lesson-rail-w)]'
            : 'grid-cols-[minmax(0,1fr)_0fr]',
        )}
        style={{ '--lesson-rail-w': DESKTOP_RAIL_WIDTH }}
      >
        <section
          className={cn(
            'relative grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden',
            showVideo ? 'bg-neutral-950' : isDark ? 'bg-neutral-950' : 'bg-muted/40',
          )}
        >
          {showVideo ? (
            <div className="relative grid min-h-0 grid-rows-[minmax(0,1fr)]">
              <div
                ref={stageRef}
                className="relative min-h-0 min-w-0 overflow-hidden bg-neutral-950"
                data-testid="lesson-video-stage"
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
                  onPresenceChange={setLivePresence}
                />
              </div>

              {/* Floating dock — overlays video bottom, does not steal layout height */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10">
                <LessonVideoControls
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
                  showQuickPanels={!isDesktop}
                  showPanelButton={false}
                  chatUnread={lessonChatUnread}
                  onOpenChat={() => openSheetTab('chat')}
                  onOpenMaterials={() => openSheetTab('materials')}
                  onOpenParticipants={() => openSheetTab('participants')}
                  onOpenPanel={openPanel}
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 items-start justify-center overflow-y-auto overscroll-contain p-4 sm:items-center sm:p-6">
              <div className="w-full max-w-lg">
                {joinError ? (
                  <div
                    className={cn(
                      'space-y-4 rounded-2xl border p-6 text-center sm:p-8',
                      isDark
                        ? 'border-rose-900/50 bg-neutral-900'
                        : 'border-rose-200 bg-card',
                    )}
                    data-testid="lesson-video-join-error"
                  >
                    <p className={cn('font-medium', isDark ? 'text-rose-300' : 'text-rose-700')}>
                      Не удалось подключиться к видеоконференции.
                    </p>
                    <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-muted-foreground')}>
                      {joinError}
                    </p>
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
                        className="min-h-11"
                        onClick={() => navigate(backPath)}
                      >
                        Назад
                      </Button>
                    </div>
                  </div>
                ) : sessionEnded ? (
                  <div
                    className={cn(
                      'space-y-4 rounded-2xl border p-6 text-center sm:p-8',
                      isDark ? 'border-white/10 bg-neutral-900' : 'border-border bg-card',
                    )}
                  >
                    <p className="font-medium">Вы вышли из урока</p>
                    <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-muted-foreground')}>
                      Можно вернуться в видео или открыть чат и материалы в панели урока.
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
                        className="min-h-11"
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

        {/* Desktop informational rail — collapses to 0fr without remounting video */}
        <aside
          className={cn(
            'min-h-0 min-w-0 overflow-hidden border-l transition-[border-color] duration-300',
            desktopRailVisible
              ? isDark
                ? 'border-white/10'
                : 'border-border'
              : 'border-transparent',
          )}
          aria-hidden={!desktopRailVisible}
          data-testid="lesson-video-desktop-rail"
        >
          <div
            className="flex h-full flex-col"
            style={{ width: DESKTOP_RAIL_WIDTH, minWidth: '17.5rem' }}
          >
            <LessonVideoSideRail {...sideRailProps} />
          </div>
        </aside>
      </div>

      {/* Mobile / tablet: bottom sheet only — no permanent side panel */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className={cn(
            'flex h-[min(85dvh,100%)] max-h-[85dvh] w-full flex-col gap-0 rounded-t-2xl p-0 safe-pb',
            isDark
              ? 'border-white/10 bg-neutral-950 text-slate-100'
              : 'border-border bg-card text-foreground',
          )}
        >
          <div
            className={cn(
              'mx-auto mt-2 h-1 w-10 shrink-0 rounded-full',
              isDark ? 'bg-white/20' : 'bg-muted-foreground/30',
            )}
            aria-hidden
          />
          <SheetHeader className={cn('shrink-0 border-b px-4 py-3 pr-12', isDark ? 'border-white/10' : 'border-border')}>
            <SheetTitle className={cn('text-left text-base', isDark ? 'text-slate-100' : 'text-foreground')}>
              Панель урока
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <LessonVideoSideRail {...sideRailProps} compact />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
