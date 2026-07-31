import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/api';
import { ResultStatusBadge } from '@/components/assessment/StatusBadges';
import PageHeader from '@/components/responsive/PageHeader';
import PageShell from '@/components/responsive/PageShell';
import ResponsiveTable from '@/components/responsive/ResponsiveTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createPageUrl } from '@/utils';
import { useAssessmentResults } from '@/hooks/useAssessmentResults';
import {
  RESULT_STATUS_LABEL,
  displayPersonName,
  formatDateTime,
  fromDatetimeLocalValue,
} from '@/lib/assessment-admin';
import { unwrapItems } from '@/lib/assessment-ui';

export default function TeacherAssessmentResults() {
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);

  const [examId, setExamId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [status, setStatus] = useState('');
  const [fromLocal, setFromLocal] = useState('');
  const [toLocal, setToLocal] = useState('');
  const [applied, setApplied] = useState({
    examId: '',
    studentId: '',
    status: '',
    from: undefined,
    to: undefined,
  });

  const { results, loading, error, reload } = useAssessmentResults(applied);

  useEffect(() => {
    Promise.all([
      api.assessment.listExams({ limit: 200 }),
      api.students.list().catch(() => []),
    ]).then(([examsPayload, studentsPayload]) => {
      setExams(unwrapItems(examsPayload));
      setStudents(
        Array.isArray(studentsPayload) ? studentsPayload : unwrapItems(studentsPayload),
      );
    });
  }, []);

  const applyFilters = () => {
    setApplied({
      examId,
      studentId,
      status,
      from: fromDatetimeLocalValue(fromLocal),
      to: fromDatetimeLocalValue(toLocal),
    });
  };

  const columns = [
    {
      id: 'exam',
      header: 'Экзамен',
      cell: (row) => row.exam_name,
    },
    {
      id: 'student',
      header: 'Ученик',
      cell: (row) => row.student_name,
    },
    {
      id: 'status',
      header: 'Статус',
      cell: (row) => <ResultStatusBadge status={row.status} />,
    },
    {
      id: 'score',
      header: 'Балл',
      cell: (row) => (
        <>
          {row.score} / {row.max_score}
          {row.percent != null ? ` (${row.percent}%)` : ''}
        </>
      ),
    },
    {
      id: 'date',
      header: 'Дата',
      cell: (row) => formatDateTime(row.finished_at || row.created_at),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title={
          <div>
            <Link
              to={createPageUrl('TeacherAssessment')}
              className="text-xs text-muted-foreground hover:text-brand"
            >
              ← Мои экзамены
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
              Результаты учеников
            </h1>
          </div>
        }
        description="Итоги попыток ваших учеников"
        actions={
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <select
          className="min-h-11 md:min-h-10 h-11 md:h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
        >
          <option value="">Все экзамены</option>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select
          className="min-h-11 md:min-h-10 h-11 md:h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          <option value="">Все ученики</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {displayPersonName(s)}
            </option>
          ))}
        </select>
        <select
          className="min-h-11 md:min-h-10 h-11 md:h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Все статусы</option>
          {Object.entries(RESULT_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Input
          type="datetime-local"
          value={fromLocal}
          onChange={(e) => setFromLocal(e.target.value)}
          aria-label="Период с"
        />
        <Input
          type="datetime-local"
          value={toLocal}
          onChange={(e) => setToLocal(e.target.value)}
          aria-label="Период по"
        />
        <Button className="w-full sm:w-auto" onClick={applyFilters}>
          Применить
        </Button>
      </div>

      {error && (
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          {error.message || 'Не удалось загрузить результаты'}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : (
        <ResponsiveTable
          rows={results}
          columns={columns}
          cardTitle={(row) => row.exam_name || 'Экзамен'}
          empty="Результатов пока нет"
        />
      )}
    </PageShell>
  );
}
