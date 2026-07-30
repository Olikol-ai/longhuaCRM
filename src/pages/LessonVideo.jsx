import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, PanelRight } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { checkMediaDevices, parseJitsiDomain } from '@/lib/lesson-video';
import JitsiLessonEmbed from '@/components/video/JitsiLessonEmbed';
import VideoPrejoin from '@/components/video/VideoPrejoin';
import LessonVideoControls from '@/components/video/LessonVideoControls';
import LessonVideoSideRail from '@/components/video/LessonVideoSideRail';

function formatClock(t) {
  if (!t) return '—';
  return String(t).slice(0, 5);
}

export default function LessonVideo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const jitsiRef = useRef(null);
  const stageRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forceJoin, setForceJoin] = useState(false);
  const [joined, setJoined] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);

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
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const prepareJoin = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.video.refreshToken(id);
      if (res) setData(res);
    } catch {
      // fall back to existing access payload
    }
  }, [id]);

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

  const canJoinWindow = forceJoin || Boolean(data?.timing?.can_join);
  const phase = data?.timing?.phase;
  const tooEarly = phase === 'before' && !canJoinWindow;
  const isHost = Boolean(data?.is_host);
  const isStudent = data?.viewer_role === 'student';

  const backPath = useMemo(() => {
    if (user?.role === 'student') return createPageUrl('StudentLessons');
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

  const handleJoin = useCallback(async () => {
    if (tooEarly && !isHost) return;
    await prepareJoin();
    setForceJoin(true);
    setSessionEnded(false);
    setJoined(true);
  }, [tooEarly, isHost, prepareJoin]);

  const handleForceJoin = useCallback(async () => {
    await prepareJoin();
    setForceJoin(true);
    setSessionEnded(false);
    setJoined(true);
  }, [prepareJoin]);

  const handleLeft = useCallback(() => {
    setJoined(false);
    setSessionEnded(true);
  }, []);

  const handleJoined = useCallback(() => {
    setSessionEnded(false);
  }, []);

  const handleEmbedError = useCallback((err) => {
    toast({
      title: 'Не удалось запустить видео',
      description: userFacingError(err) || 'Попробуйте ещё раз',
      variant: 'destructive',
    });
    setJoined(false);
  }, []);

  const hangup = useCallback(() => {
    jitsiRef.current?.executeCommand?.('hangup');
    handleLeft();
  }, [handleLeft]);

  if (loading) {
    return (
      <div className="flex justify-center py-24 min-h-dvh items-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center space-y-4 min-h-dvh flex flex-col justify-center">
        <p className="text-slate-600 dark:text-slate-300">Видеоурок недоступен</p>
        <Button variant="outline" onClick={() => navigate(backPath)}>
          Назад
        </Button>
      </div>
    );
  }

  const lesson = data.lesson || {};
  const timeRange =
    lesson.time_range_label ||
    `${formatClock(lesson.start_time)}${lesson.end_time ? ` – ${formatClock(lesson.end_time)}` : ''}`;
  const domain = data.domain || parseJitsiDomain(data.room_url);
  const showVideo = joined && canJoinWindow;

  const sideRail = (
    <LessonVideoSideRail
      lessonId={id}
      lesson={lesson}
      isHost={isHost}
      isStudent={isStudent}
      materialsPath={materialsPath}
      homeworkPath={homeworkPath}
    />
  );

  return (
    <div
      className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden"
      data-testid="lesson-video-page"
    >
      <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 py-3 sm:py-4 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand mb-2"
            >
              <ArrowLeft className="h-4 w-4" /> Назад
            </button>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-brand">Longhua</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {data.subject || 'Китайский язык'}
            </p>
            <div className="mt-2 grid gap-0.5 text-sm sm:grid-cols-2">
              <p>
                <span className="text-slate-400">Урок:</span>{' '}
                <span className="font-medium">{lesson.title || 'Онлайн-урок'}</span>
              </p>
              <p>
                <span className="text-slate-400">Преподаватель:</span>{' '}
                <span className="font-medium">{lesson.teacher_name || '—'}</span>
              </p>
              <p>
                <span className="text-slate-400">Время:</span>{' '}
                <span className="font-medium">{timeRange}</span>
                {lesson.duration ? (
                  <span className="text-slate-400"> · {lesson.duration} мин</span>
                ) : null}
              </p>
              {lesson.group_name ? (
                <p>
                  <span className="text-slate-400">Группа:</span>{' '}
                  <span className="font-medium">{lesson.group_name}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {isHost && (
              <p className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Вы проводите урок
              </p>
            )}
            {phase === 'after' && (
              <div className="text-xs px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600">
                Урок завершён
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="lg:hidden"
              onClick={() => setMobileRailOpen(true)}
            >
              <PanelRight className="h-4 w-4 mr-1" /> Панель урока
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-3 items-stretch">
          <section className="space-y-2 min-w-0">
            {showVideo ? (
              <>
                <div
                  ref={stageRef}
                  className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-lg
                    h-[min(68dvh,calc(100dvh-14rem))] min-h-[280px] sm:min-h-[420px]"
                >
                  <JitsiLessonEmbed
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
                  />
                </div>
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
                />
              </>
            ) : sessionEnded ? (
              <div className="rounded-2xl border bg-white dark:bg-slate-900 p-6 sm:p-8 text-center space-y-4">
                <p className="font-medium">Вы вышли из урока</p>
                <p className="text-sm text-slate-500">
                  Можно вернуться в видео или работать с материалами в панели справа.
                </p>
                <Button type="button" onClick={handleJoin} data-testid="lesson-video-rejoin">
                  {isHost ? 'Вернуться в урок' : 'Войти в урок снова'}
                </Button>
              </div>
            ) : (
              <VideoPrejoin
                isHost={isHost}
                checking={checking}
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
          </section>

          <div className="hidden lg:block min-h-[420px]">{sideRail}</div>
        </div>
      </div>

      <Sheet open={mobileRailOpen} onOpenChange={setMobileRailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle>Панель урока</SheetTitle>
          </SheetHeader>
          <div className="p-3 h-[calc(100%-3rem)]">
            <LessonVideoSideRail
              lessonId={id}
              lesson={lesson}
              isHost={isHost}
              isStudent={isStudent}
              materialsPath={materialsPath}
              homeworkPath={homeworkPath}
              compact
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
