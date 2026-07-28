import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { Loader2, BookOpen, ChevronRight } from 'lucide-react';
import { localizeEntityStatus } from '@/lib/locale-by';

/**
 * Admin list of tutors with platform usage metrics.
 * Opens personal cabinet management at /admin/tutors/:id.
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
        if (!cancelled) setError(err?.message || 'Не удалось загрузить репетиторов');
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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5" data-testid="admin-tutors-list">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-600" /> Репетиторы
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Управление личными кабинетами репетиторов. Ученики блокнота не входят в CRM школы.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-400 uppercase">
              <th className="px-4 py-3">ФИО</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Ученики</th>
              <th className="px-4 py-3">Занятий</th>
              <th className="px-4 py-3">Часов</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">Репетиторы не найдены</td>
              </tr>
            ) : rows.map((row) => {
              const id = row.tutor_id || row.tutorId;
              return (
                <tr
                  key={id}
                  className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/tutors/${id}`}
                      className="font-medium text-slate-800 dark:text-slate-100 hover:text-brand"
                    >
                      {row.display_name || row.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${row.status === 'active' ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {localizeEntityStatus(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.active_students_count ?? row.activeStudentsCount ?? row.students_count ?? row.studentsCount ?? 0}
                  </td>
                  <td className="px-4 py-3">{row.completed_lessons_count ?? row.completedLessonsCount ?? 0}</td>
                  <td className="px-4 py-3">{row.teaching_hours ?? row.teachingHours ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/tutors/${id}`}
                      className="inline-flex items-center text-slate-400 hover:text-brand"
                      aria-label="Открыть кабинет"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
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
