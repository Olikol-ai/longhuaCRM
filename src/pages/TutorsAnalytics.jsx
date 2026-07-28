import { useEffect, useState } from 'react';
import { api } from '@/api';
import { Loader2, BookOpen } from 'lucide-react';

/**
 * Admin: platform usage for external tutors — lesson count and hours only.
 * Does not expose personal notebook pupil lists.
 */
export default function TutorsAnalytics() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.tutors.analyticsOverview();
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Не удалось загрузить аналитику репетиторов');
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

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5" data-testid="admin-tutors-stats">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-600" /> Репетиторы
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Статистика использования платформы: занятия и часы. Личные записи учеников репетитора не показываются.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-400 uppercase">
              <th className="px-4 py-3">Репетитор</th>
              <th className="px-4 py-3">Занятий</th>
              <th className="px-4 py-3">Часов</th>
              <th className="px-4 py-3">Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-400">Репетиторы не найдены</td>
              </tr>
            ) : rows.map((row) => {
              const id = row.tutor_id || row.tutorId;
              return (
                <tr
                  key={id}
                  className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{row.display_name || row.displayName}</p>
                    <p className="text-xs text-slate-400">{row.email || '—'}</p>
                  </td>
                  <td className="px-4 py-3">{row.completed_lessons_count ?? row.completedLessonsCount ?? 0}</td>
                  <td className="px-4 py-3">{row.teaching_hours ?? row.teachingHours ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${row.status === 'active' ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {row.status === 'active' ? 'Активен' : row.status === 'pending' ? 'Ожидает' : 'Неактивен'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
