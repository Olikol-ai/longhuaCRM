import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { api } from '@/api';
import { ResultStatusBadge } from '@/components/assessment/StatusBadges';
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
import ResponsiveTable from '@/components/responsive/ResponsiveTable';

export default function AssessmentResults() {
  const navigate = useNavigate();
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to={createPageUrl('AdminAssessment')}
            className="text-xs text-muted-foreground hover:text-brand dark:hover:text-brand"
          >
            ← Проверочные работы
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">
            Результаты
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Итоги попыток: баллы, процент, статус
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="passed">{RESULT_STATUS_LABEL.passed}</option>
          <option value="failed">{RESULT_STATUS_LABEL.failed}</option>
          <option value="pending_review">{RESULT_STATUS_LABEL.pending_review}</option>
        </select>
        <Input
          type="datetime-local"
          value={fromLocal}
          onChange={(e) => setFromLocal(e.target.value)}
          title="С даты"
        />
        <Input
          type="datetime-local"
          value={toLocal}
          onChange={(e) => setToLocal(e.target.value)}
          title="По дату"
        />
        <Button variant="outline" onClick={applyFilters}>
          Применить фильтры
        </Button>
      </div>

      {error && (
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <p className="font-medium">Ошибка загрузки</p>
          <p className="mt-1">{error.message}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center space-y-3">
          <Trophy className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
            Результатов нет
          </h2>
          <p className="text-sm text-muted-foreground">
            Измените фильтры или дождитесь сдачи экзаменов.
          </p>
        </div>
      ) : (
        <ResponsiveTable
          rows={results}
          cardTitle={(row) => row.student_name}
          columns={[
            { id: 'exam', header: 'Экзамен', cell: (row) => row.exam_name },
            { id: 'score', header: 'Балл', cell: (row) => row.score ?? '—' },
            { id: 'max', header: 'Макс.', cell: (row) => row.max_score ?? '—' },
            {
              id: 'percent',
              header: '%',
              cell: (row) => (row.percent != null ? `${Number(row.percent).toFixed(0)}%` : '—'),
            },
            {
              id: 'status',
              header: 'Статус',
              cell: (row) => <ResultStatusBadge status={row.status} />,
            },
            {
              id: 'date',
              header: 'Дата',
              cell: (row) => formatDateTime(row.finished_at || row.created_at),
            },
          ]}
          cardActions={(row) => (
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() =>
                navigate(
                  `${createPageUrl('AssessmentResultDetail')}?id=${encodeURIComponent(row.id)}`,
                )
              }
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Открыть
            </Button>
          )}
        />
      )}
    </div>
  );
}
