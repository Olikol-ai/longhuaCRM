import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Maximize2, PhoneOff } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  checkMediaDevices,
  mapVideoConferenceError,
  parseJitsiDomain,
} from '@/lib/lesson-video';
import { useVideoSession } from '@/lib/VideoSessionContext';
import VideoPrejoin from '@/components/video/VideoPrejoin';

/**
 * Lesson video entry page: access + prejoin.
 * Once joined, the live conference lives in VideoSessionLayer (global),
 * so CRM navigation no longer tears down WebRTC.
 */
export default function LessonVideo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoSession = useVideoSession();
  const didInitialDeviceCheckRef = useRef(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forceJoin, setForceJoin] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [joining, setJoining] = useState(false);

  const sessionMatches =
    videoSession.active &&
    String(videoSession.session?.lessonId) === String(id);

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
      setChecks(await checkMediaDevices());
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
    if (loading || !data || didInitialDeviceCheckRef.current) return;
    if (sessionMatches || joining) return;
    didInitialDeviceCheckRef.current = true;
    void runDeviceCheck();
  }, [loading, data, runDeviceCheck, sessionMatches, joining]);

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
    try {
      const access = await prepareJoin();
      const token = access?.token || data?.token;
      const room =
        access?.room_name || access?.room_id || data?.room_name || data?.room_id;
      const host =
        access?.domain ||
        data?.domain ||
        parseJitsiDomain(access?.room_url || data?.room_url);
      if (!token || !room || !host) {
        setJoinError(
          'Не удалось получить доступ к видеоконференции. Обновите страницу и попробуйте снова.',
        );
        return;
      }
      setForceJoin(true);
      const payloadAccess = access || data;
      videoSession.startSession({
        lessonId: id,
        jwt: token,
        tokenExpiresAt:
          access?.token_expires_at ??
          data?.token_expires_at ??
          null,
        domain: host,
        roomName: room,
        roomUrl: payloadAccess?.room_url || data?.room_url,
        displayName: payloadAccess?.display_name || data?.display_name,
        subject: payloadAccess?.conference_subject || payloadAccess?.subject || data?.subject,
        externalApiUrl: payloadAccess?.external_api_url || data?.external_api_url,
        access: payloadAccess,
        isHost,
        isStudent,
        viewerRole: payloadAccess?.viewer_role || data?.viewer_role,
        materialsPath,
        homeworkPath,
        backPath,
        crmUserId: user?.id || null,
        crmEmail: user?.email || null,
      });
    } catch (err) {
      const mapped = mapVideoConferenceError(err);
      setJoinError(mapped.description || userFacingError(err));
    } finally {
      setJoining(false);
    }
  }, [
    prepareJoin,
    data,
    videoSession,
    id,
    isHost,
    isStudent,
    materialsPath,
    homeworkPath,
    backPath,
    user?.id,
    user?.email,
  ]);

  if (loading) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-foreground"
        data-testid="lesson-video-page-loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium">Загрузка урока…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-muted-foreground">Видеоурок недоступен</p>
        <Button variant="outline" className="min-h-11" onClick={() => navigate(backPath)}>
          Назад
        </Button>
      </div>
    );
  }

  // Live conference chrome is owned by VideoSessionLayer.
  if (sessionMatches && videoSession.mode === 'full') {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground"
        data-testid="lesson-video-page-delegated"
      >
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (sessionMatches && videoSession.mode === 'mini') {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center"
        data-testid="lesson-video-page-minimized"
      >
        <p className="text-lg font-semibold text-foreground">Урок идёт в мини-окне</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Камера и микрофон активны. Можно работать в CRM или вернуться к полному
          интерфейсу урока.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" className="min-h-11" onClick={() => videoSession.expand()}>
            <Maximize2 className="mr-2 h-4 w-4" />
            Развернуть урок
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => videoSession.requestEnd(videoSession.endSession)}
          >
            <PhoneOff className="mr-2 h-4 w-4" />
            Завершить урок
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => navigate(backPath)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            К расписанию
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-background text-foreground"
      data-testid="lesson-video-page"
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {data.lesson?.title || 'Онлайн-урок'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {data.subject || 'Китайский язык'}
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        <div className="w-full max-w-lg">
          {joinError ? (
            <div
              className="space-y-4 rounded-2xl border border-rose-200 bg-card p-6 text-center shadow-sm dark:border-rose-900/50 sm:p-8"
              data-testid="lesson-video-join-error"
            >
              <p className="font-medium text-rose-700 dark:text-rose-300">
                Не удалось подключиться к видеоуроку
              </p>
              <p className="text-sm text-muted-foreground">{joinError}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={enterConference}
                  disabled={joining}
                >
                  {joining ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Подключение…
                    </>
                  ) : (
                    'Повторить подключение'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => navigate(backPath)}
                >
                  Покинуть
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
              onJoin={enterConference}
              onForceJoin={enterConference}
              joinLabel={joinLabel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
