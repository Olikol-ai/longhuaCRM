import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ArrowLeft, Video } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';

function formatTime(t) {
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

  const canJoin = forceJoin || Boolean(data?.timing?.can_join);
  const phase = data?.timing?.phase;

  const backPath = useMemo(() => {
    if (user?.role === 'student') return createPageUrl('StudentLessons');
    if (user?.role === 'teacher') return createPageUrl('TeacherSchedule');
    if (user?.role === 'tutor') return createPageUrl('TutorSchedule');
    return createPageUrl('Dashboard');
  }, [user?.role]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center space-y-4">
        <p className="text-slate-600">Видеоурок недоступен</p>
        <Button variant="outline" onClick={() => navigate(backPath)}>
          Назад
        </Button>
      </div>
    );
  }

  const lesson = data.lesson || {};

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" data-testid="lesson-video-page">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand mb-2"
            >
              <ArrowLeft className="h-4 w-4" /> Назад
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Video className="h-5 w-5 text-brand" />
              Онлайн-урок
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {lesson.date} · {formatTime(lesson.start_time)}
              {lesson.duration ? ` · ${lesson.duration} мин` : ''}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Преподаватель: {lesson.teacher_name || '—'}
              {lesson.student_name ? ` · Ученик: ${lesson.student_name}` : ''}
            </p>
          </div>
          {phase === 'after' && (
            <div className="text-xs px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600">
              Урок завершён — можно просмотреть комнату
            </div>
          )}
        </div>

        {!canJoin && phase === 'before' ? (
          <div className="rounded-2xl border bg-white dark:bg-slate-900 p-8 text-center space-y-4">
            <p className="text-slate-700 dark:text-slate-200 font-medium">
              Видеоурок ещё не начался
            </p>
            <p className="text-sm text-slate-500">
              Войти можно за 10 минут до начала
              {typeof data.timing?.minutes_until_start === 'number'
                ? ` (через ${Math.max(0, data.timing.minutes_until_start)} мин)`
                : ''}
              .
            </p>
            {(user?.role === 'admin' || user?.role === 'teacher') && (
              <Button variant="outline" onClick={() => setForceJoin(true)}>
                Начать видеоурок досрочно
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border bg-black aspect-video shadow-lg">
            <iframe
              title="Онлайн-урок"
              src={data.embed_url || data.room_url}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              allowFullScreen
              className="w-full h-full min-h-[360px] sm:min-h-[480px]"
              data-testid="lesson-video-iframe"
            />
          </div>
        )}
      </div>
    </div>
  );
}
