import { useEffect, useState } from 'react';
import { api } from '@/api';
import TutorsAnalytics from './TutorsAnalytics';
import { Card } from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';

/**
 * Admin section: tutors overview + isolated tutor students list.
 * School students are never mixed here.
 */
export default function AdminTutors() {
  const [tutorStudents, setTutorStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.tutors.allStudents();
        if (!cancelled) setTutorStudents(Array.isArray(rows) ? rows : []);
      } catch (err) {
        if (!cancelled) {
          setStudentsError(err?.message || 'Не удалось загрузить учеников репетиторов');
        }
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <TutorsAnalytics />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" />
            Ученики репетиторов
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Отдельный список. Не смешивается с учениками школы Longhua.
          </p>
        </div>

        {studentsError && <p className="text-sm text-red-600">{studentsError}</p>}

        {loadingStudents ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : tutorStudents.length === 0 ? (
          <Card className="p-8 text-center text-slate-400">Учеников репетиторов пока нет</Card>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-400 uppercase">
                  <th className="px-4 py-3">Ученик репетитора</th>
                  <th className="px-4 py-3">Репетитор</th>
                  <th className="px-4 py-3">Эл. почта</th>
                  <th className="px-4 py-3">Телефон</th>
                  <th className="px-4 py-3">Статус</th>
                </tr>
              </thead>
              <tbody>
                {tutorStudents.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {row.tutor?.display_name || row.tutor?.displayName || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{row.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold ${
                          row.status === 'active' ? 'text-emerald-600' : 'text-slate-500'
                        }`}
                      >
                        {row.status === 'active'
                          ? 'Активен'
                          : row.status === 'paused'
                            ? 'Пауза'
                            : 'Неактивен'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
