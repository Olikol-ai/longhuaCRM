import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { formatHelloGreeting } from '@/lib/display-name';
import StatCard from '@/components/dashboard/StatCard';
import { resolveLessonStudentLabel } from '@/lib/studentLabels';
import { filterLessonsWithinNext48Hours } from '@/lib/teacherUpcomingLessons';
import {
  computeCompletedLessonsMonthStats,
  formatCompletedMonthComparison,
} from '@/lib/completedLessonsMonthStats';
import { BookOpen, CheckCircle2, Clock, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function TutorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const loadData = async () => {
    setError('');
    try {
      const [me, myStats, allLessons, allStudents] = await Promise.all([
        api.tutors.me(),
        api.tutors.myStats(),
        api.lessons.list('-date', 200),
        api.tutors.myStudents(),
      ]);
      setProfile(me);
      setStats(myStats);
      setLessons((Array.isArray(allLessons) ? allLessons : []).filter((l) => l.tutor_id === me.id));
      setStudents((Array.isArray(allStudents) ? allStudents : []).filter((s) => s.status !== 'inactive'));
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить кабинет репетитора');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const upcoming = useMemo(
    () => filterLessonsWithinNext48Hours(lessons.filter((l) => l.status === 'planned')),
    [lessons],
  );

  const markComplete = async (lesson) => {
    const confirmed = window.confirm('Подтвердить проведение занятия?');
    if (!confirmed) return;
    setUpdating(lesson.id);
    try {
      await api.lessons.update(lesson.id, { status: 'completed', completion_attendance: 'attended' });
      toast({ title: 'Занятие проведено' });
      await loadData();
    } catch (err) {
      toast({ title: 'Ошибка', description: err?.message, variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  const hours = stats?.teaching_hours ?? stats?.teachingHours
    ?? ((stats?.teaching_minutes ?? stats?.teachingMinutes ?? 0) / 60).toFixed(1);

  const completedMonth = formatCompletedMonthComparison(
    computeCompletedLessonsMonthStats(lessons),
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatHelloGreeting({
              ...user,
              display_name:
                profile?.display_name || profile?.displayName || user?.display_name,
            })}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Ваш кабинет на платформе Longhua</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={createPageUrl('TutorSchedule')}>Расписание</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={createPageUrl('TutorStudents')}>Ученики</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={createPageUrl('TutorReferralLinks')}>Ссылки</Link>
          </Button>
          <Button asChild size="sm">
            <Link to={createPageUrl('TutorStats')}>Статистика</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ученики" value={stats?.students_count ?? stats?.studentsCount ?? students.length} icon={Users} color="brand" />
        <StatCard label="Активные" value={stats?.active_students_count ?? stats?.activeStudentsCount ?? 0} icon={BookOpen} color="emerald" />
        <StatCard
          label={completedMonth.label}
          value={completedMonth.value}
          icon={CheckCircle2}
          color="muted"
          previousLine={completedMonth.previousLine}
          trendLine={completedMonth.trendLine}
          trendTone={completedMonth.trendTone}
        />
        <StatCard label="Часы" value={hours} icon={Clock} color="amber" />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ближайшие 48 часов</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">Нет запланированных занятий на ближайшее время</p>
        ) : upcoming.map((lesson) => (
          <div key={lesson.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
            <div>
              <p className="text-sm font-medium">{resolveLessonStudentLabel(lesson, students)}</p>
              <p className="text-xs text-slate-500">
                {format(new Date(`${lesson.date}T12:00:00`), 'd MMM', { locale: ru })} · {(lesson.start_time || '').slice(0, 5)}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={updating === lesson.id}
              onClick={() => markComplete(lesson)}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Провести
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
