import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  NotebookPen,
  MessageCircle,
  Video,
} from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { checkMediaDevices, parseJitsiDomain } from '@/lib/lesson-video';
import JitsiLessonEmbed from '@/components/video/JitsiLessonEmbed';
import VideoPrejoin from '@/components/video/VideoPrejoin';

function formatClock(t) {
  if (!t) return '—';
  return String(t).slice(0, 5);
}

export default function LessonVideo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forceJoin, setForceJoin] = useState(false);
  const [joined, setJoined] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);

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

  const runDeviceCheck = useCallback(async () => {
    setChecking(true);
    try {
      const result = await checkMediaDevices();
      setChecks(result);
    } catch {
      setChecks({
        camera: { ok: false, label: 'Камера' },
        microphone: { ok: false, label: 'Микрофон' },
        network: { ok: typeof navigator !== 'undefined' && navigator.onLine !== false, label: 'Интернет' },
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

  const handleJoin = useCallback(() => {
    if (tooEarly && !isHost) return;
    setForceJoin(true);
    setSessionEnded(false);
    setJoined(true);
  }, [tooEarly, isHost]);

  const handleForceJoin = useCallback(() => {
    setForceJoin(true);
    setSessionEnded(false);
    setJoined(true);
  }, []);

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

  return (
    <div
      className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden"
      data-testid="lesson-video-page"
    >
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-3 sm:py-5 space-y-3 sm:space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* Brand + lesson meta */}
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
            <div className="mt-3 space-y-1 text-sm">
              <p>
                <span className="text-slate-400">Урок:</span>{' '}
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {lesson.title || 'Онлайн-урок'}
                </span>
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
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {isHost && (
              <div className="text-right space-y-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Вы проводите урок
                </p>
                <p className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Онлайн
                </p>
                <p className="text-[11px] text-slate-400">
                  Начало {formatClock(lesson.start_time)}
                </p>
              </div>
            )}
            {isStudent && !showVideo && (
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Ваш урок начинается
              </p>
            )}
            {phase === 'after' && (
              <div className="text-xs px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Урок завершён
              </div>
            )}
          </div>
        </header>

        {/* Video stage */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Video className="h-3.5 w-3.5" /> Видео
          </div>

          {showVideo ? (
            <div
              className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-lg
                h-[min(72dvh,calc(100dvh-12rem))] min-h-[280px] sm:min-h-[420px]"
            >
              <JitsiLessonEmbed
                domain={domain}
                roomName={data.room_name || data.room_id}
                roomUrl={data.room_url}
                displayName={data.display_name}
                externalApiUrl={data.external_api_url}
                jwt={data.token}
                onLeft={handleLeft}
                onJoined={handleJoined}
                onError={handleEmbedError}
              />
            </div>
          ) : sessionEnded ? (
            <div className="rounded-2xl border bg-white dark:bg-slate-900 p-6 sm:p-8 text-center space-y-4">
              <p className="font-medium text-slate-800 dark:text-slate-100">Вы вышли из урока</p>
              <p className="text-sm text-slate-500">
                Можно вернуться в видео или открыть материалы и домашнее задание.
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

        {/* Side tools */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <Link
            to={materialsPath}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 hover:border-brand/40 transition-colors min-w-0"
          >
            <BookOpen className="h-5 w-5 text-brand shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Материалы</p>
              <p className="text-xs text-slate-400 truncate">Учебные материалы урока</p>
            </div>
          </Link>
          <Link
            to={homeworkPath}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 hover:border-brand/40 transition-colors min-w-0"
          >
            <NotebookPen className="h-5 w-5 text-brand shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Домашнее задание</p>
              <p className="text-xs text-slate-400 truncate">Задания к уроку</p>
            </div>
          </Link>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 min-w-0">
            <MessageCircle className="h-5 w-5 text-brand shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Чат</p>
              <p className="text-xs text-slate-400">
                {showVideo
                  ? 'Откройте чат в панели видео'
                  : 'Чат будет доступен внутри видеоурока'}
              </p>
            </div>
          </div>
        </section>

        {showVideo && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
              onClick={handleLeft}
            >
              Завершить урок
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
