import { useEffect, useState } from 'react';
import { api } from '@/api';
import { Loader2, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

function formatActivity(value) {
  if (!value) return '—';
  try {
    const d = new Date(value.includes('T') ? value : `${value}T12:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return format(d, 'd MMM yyyy HH:mm', { locale: ru });
  } catch {
    return value;
  }
}

export default function TutorsAnalytics() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
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

  const openDetail = async (row) => {
    setSelected(row);
    setDetailLoading(true);
    setDetail(null);
    try {
      const stats = await api.tutors.stats(row.tutor_id || row.tutorId);
      setDetail(stats);
    } catch (err) {
      setDetail({ error: err?.message || 'Не удалось загрузить детали' });
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const history = Array.isArray(detail?.activity_history)
    ? detail.activity_history
    : Array.isArray(detail?.activityHistory)
      ? detail.activityHistory
      : [];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-600" /> Репетиторы
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Использование платформы внешними репетиторами. Финансы и комиссия — на следующем этапе.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-400 uppercase">
              <th className="px-4 py-3">Репетитор</th>
              <th className="px-4 py-3">Ученики</th>
              <th className="px-4 py-3">Проведено</th>
              <th className="px-4 py-3">Часы</th>
              <th className="px-4 py-3">Будущие</th>
              <th className="px-4 py-3">Последняя активность</th>
              <th className="px-4 py-3">Статус</th>
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
                  className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer"
                  onClick={() => openDetail(row)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{row.display_name || row.displayName}</p>
                    <p className="text-xs text-slate-400">{row.email || '—'}</p>
                  </td>
                  <td className="px-4 py-3">{row.active_students_count ?? row.activeStudentsCount ?? 0}</td>
                  <td className="px-4 py-3">{row.completed_lessons_count ?? row.completedLessonsCount ?? 0}</td>
                  <td className="px-4 py-3">{row.teaching_hours ?? row.teachingHours ?? 0}</td>
                  <td className="px-4 py-3">{row.upcoming_lessons_count ?? row.upcomingLessonsCount ?? 0}</td>
                  <td className="px-4 py-3 text-xs">{formatActivity(row.last_activity_at ?? row.lastActivityAt)}</td>
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

      {selected && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{selected.display_name || selected.displayName}</h2>
              <p className="text-xs text-slate-500">История активности (только completed)</p>
            </div>
            <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={() => { setSelected(null); setDetail(null); }}>
              Закрыть
            </button>
          </div>

          {detailLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          ) : detail?.error ? (
            <p className="text-sm text-red-600">{detail.error}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-400">Активные ученики</p>
                  <p className="font-semibold mt-1">{detail?.active_students_count ?? detail?.activeStudentsCount ?? 0}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-400">Проведено</p>
                  <p className="font-semibold mt-1">{detail?.completed_lessons_count ?? detail?.completedLessonsCount ?? 0}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-400">Часы</p>
                  <p className="font-semibold mt-1">{detail?.teaching_hours ?? detail?.teachingHours ?? 0}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-400">Будущие</p>
                  <p className="font-semibold mt-1">{detail?.upcoming_lessons_count ?? detail?.upcomingLessonsCount ?? 0}</p>
                </div>
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-slate-400">Нет проведённых занятий</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {history.map((item) => (
                    <li key={item.lesson_id || item.lessonId} className="flex justify-between gap-3 border-b border-slate-50 dark:border-slate-800 pb-2">
                      <span>
                        {item.date} {(item.start_time || item.startTime || '').toString().slice(0, 5)}
                        {' · '}
                        {item.student_name || item.studentName || 'Ученик'}
                      </span>
                      <span className="text-slate-400">{item.duration || 60} мин</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
