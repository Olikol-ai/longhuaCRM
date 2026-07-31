import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { Loader2, BookOpen, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/responsive/PageHeader';
import PageShell from '@/components/responsive/PageShell';
import ResponsiveTable from '@/components/responsive/ResponsiveTable';
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
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const columns = [
    {
      id: 'name',
      header: 'ФИО',
      cell: (row) => {
        const id = row.tutor_id || row.tutorId;
        return (
          <Link
            to={`/admin/tutors/${id}`}
            className="font-medium text-foreground hover:text-brand"
          >
            {row.display_name || row.displayName}
          </Link>
        );
      },
    },
    {
      id: 'email',
      header: 'Email',
      cell: (row) => row.email || '—',
    },
    {
      id: 'status',
      header: 'Статус',
      cell: (row) => (
        <span
          className={`text-xs font-semibold ${
            row.status === 'active' ? 'text-emerald-600' : 'text-muted-foreground'
          }`}
        >
          {localizeEntityStatus(row.status)}
        </span>
      ),
    },
    {
      id: 'students',
      header: 'Ученики',
      cell: (row) =>
        row.active_students_count ??
        row.activeStudentsCount ??
        row.students_count ??
        row.studentsCount ??
        0,
    },
    {
      id: 'lessons',
      header: 'Занятий',
      cell: (row) => row.completed_lessons_count ?? row.completedLessonsCount ?? 0,
    },
    {
      id: 'hours',
      header: 'Часов',
      cell: (row) => row.teaching_hours ?? row.teachingHours ?? 0,
    },
  ];

  return (
    <PageShell data-testid="admin-tutors-list">
      <PageHeader
        title={
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand shrink-0" /> Репетиторы
          </h1>
        }
        description="Управление личными кабинетами репетиторов. Ученики блокнота не входят в CRM школы."
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ResponsiveTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.tutor_id || row.tutorId}
        cardTitle={(row) => row.display_name || row.displayName || 'Репетитор'}
        cardActions={(row) => {
          const id = row.tutor_id || row.tutorId;
          return (
            <Link
              to={`/admin/tutors/${id}`}
              className="inline-flex items-center gap-1 text-sm text-brand min-h-touch"
            >
              Открыть <ChevronRight className="h-4 w-4" />
            </Link>
          );
        }}
        empty="Репетиторы не найдены"
      />
    </PageShell>
  );
}
