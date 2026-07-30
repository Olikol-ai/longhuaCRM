import { useEffect, useState } from 'react';
import { api } from '@/api';
import StatCard from '@/components/dashboard/StatCard';
import { BookOpen, Calendar, Clock, Loader2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import ResponsiveTable from '@/components/responsive/ResponsiveTable';

export default function TutorStats() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.tutors.myStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Не удалось загрузить статистику');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  const history = Array.isArray(stats?.activity_history)
    ? stats.activity_history
    : Array.isArray(stats?.activityHistory)
      ? stats.activityHistory
      : [];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Статистика</h1>
        <p className="text-sm text-slate-500 mt-1">
          Учитываются только проведённые занятия (без отменённых и перенесённых)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Активные ученики" value={stats?.active_students_count ?? stats?.activeStudentsCount ?? 0} icon={Users} color="emerald" />
        <StatCard label="Проведено занятий" value={stats?.completed_lessons_count ?? stats?.completedLessonsCount ?? 0} icon={Calendar} color="brand" />
        <StatCard label="Часы занятий" value={stats?.teaching_hours ?? stats?.teachingHours ?? (((stats?.teaching_minutes ?? stats?.teachingMinutes ?? 0) / 60).toFixed(1))} icon={Clock} color="amber" />
        <StatCard label="Будущие занятия" value={stats?.upcoming_lessons_count ?? stats?.upcomingLessonsCount ?? 0} icon={BookOpen} color="muted" />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">История проведённых занятий</h2>
        </div>
        {history.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Пока нет проведённых занятий</p>
        ) : (
          <div className="p-3 sm:p-4">
            <ResponsiveTable
              rows={history}
              getRowKey={(row) => row.lesson_id || row.lessonId}
              cardTitle={(row) => row.student_name || row.studentName || '—'}
              columns={[
                {
                  id: 'date',
                  header: 'Дата',
                  cell: (row) => {
                    const date = row.date;
                    try {
                      return format(new Date(`${date}T12:00:00`), 'd MMM yyyy', { locale: ru });
                    } catch {
                      return date;
                    }
                  },
                },
                {
                  id: 'time',
                  header: 'Время',
                  cell: (row) => (row.start_time || row.startTime || '').toString().slice(0, 5),
                },
                {
                  id: 'student',
                  header: 'Ученик',
                  hideOnCard: true,
                  cell: (row) => row.student_name || row.studentName || '—',
                },
                {
                  id: 'duration',
                  header: 'Длительность',
                  cell: (row) => `${row.duration || 60} мин`,
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
