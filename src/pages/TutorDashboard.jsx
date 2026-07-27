import { useEffect, useState } from 'react';
import { api } from '@/api';
import StatCard from '@/components/dashboard/StatCard';
import { BookOpen, Calendar, Clock, Users } from 'lucide-react';

export default function TutorDashboard() {
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, myStats] = await Promise.all([
          api.tutors.me(),
          api.tutors.myStats(),
        ]);
        if (!cancelled) {
          setProfile(me);
          setStats(myStats);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Не удалось загрузить кабинет репетитора');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const hours = ((stats?.teachingMinutes || 0) / 60).toFixed(1);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Кабинет репетитора
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {profile?.display_name || profile?.displayName || 'Репетитор'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Ученики"
          value={stats?.studentsCount ?? 0}
          icon={Users}
          color="brand"
        />
        <StatCard
          label="Активные ученики"
          value={stats?.activeStudentsCount ?? 0}
          icon={BookOpen}
          color="emerald"
        />
        <StatCard
          label="Проведённые уроки"
          value={stats?.completedLessonsCount ?? 0}
          icon={Calendar}
          color="muted"
        />
        <StatCard
          label="Часы преподавания"
          value={hours}
          icon={Clock}
          color="amber"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
          Ближайшие занятия
        </h2>
        <p className="text-sm text-slate-500">
          Запланировано: {stats?.upcomingLessonsCount ?? 0}
        </p>
        <p className="text-xs text-slate-400 mt-3">
          Финансовая статистика и комиссия Longhua появятся на следующем этапе.
        </p>
      </div>
    </div>
  );
}
