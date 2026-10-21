import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { api } from '@/api';
import { ResultStatusBadge } from '@/components/assessment/StatusBadges';
import ResponsiveTable from '@/components/responsive/ResponsiveTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createPageUrl } from '@/utils';
import {
  RESULT_STATUS_LABEL,
  formatDateTime,
  fromDatetimeLocalValue,
} from '@/lib/assessment-admin';

const PAGE_SIZE = 25;

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

export default function AdminExamRegistry() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'exams' ? 'exams' : 'attempts';

  const [examSearch, setExamSearch] = useState(params.get('exam_search') || '');
  const [studentSearch, setStudentSearch] = useState(
    params.get('student_search') || '',
  );
  const [attemptStatus, setAttemptStatus] = useState(
    params.get('attempt_status') || '',
  );
  const [resultStatus, setResultStatus] = useState(
    params.get('result_status') || '',
  );
  const [manualOnly, setManualOnly] = useState(params.get('manual_only') === '1');
  const [fromLocal, setFromLocal] = useState(params.get('from_local') || '');
  const [toLocal, setToLocal] = useState(params.get('to_local') || '');
  const [offset, setOffset] = useState(Number(params.get('offset') || 0) || 0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState({ items: [], total: 0 });

  const setTab = (next) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('tab', next);
    nextParams.set('offset', '0');
    setParams(nextParams);
    setOffset(0);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'exams') {
        const data = await api.assessment.adminListExams({
          limit: PAGE_SIZE,
          offset,
          search: examSearch.trim() || undefined,
        });
        setPayload({
          items: data.items || [],
          total: Number(data.total) || 0,
        });
      } else {
        const data = await api.assessment.adminListAttempts({
          limit: PAGE_SIZE,
          offset,
          exam_search: examSearch.trim() || undefined,
          student_search: studentSearch.trim() || undefined,
          attempt_status: attemptStatus || undefined,
          result_status: resultStatus || undefined,
          manual_only: manualOnly || undefined,
          from: fromDatetimeLocalValue(fromLocal),
          to: fromDatetimeLocalValue(toLocal),
        });
        setPayload({
          items: data.items || [],
          total: Number(data.total) || 0,
        });
      }
    } catch (err) {
      setError(err);
      setPayload({ items: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    offset,
    examSearch,
    studentSearch,
    attemptStatus,
    resultStatus,
    manualOnly,
    fromLocal,
    toLocal,
  ]);

  useEffect(() => {
    reload();
  }, [reload]);

  const applyFilters = () => {
    const nextParams = new URLSearchParams();
    nextParams.set('tab', tab);
    nextParams.set('offset', '0');
    if (examSearch.trim()) nextParams.set('exam_search', examSearch.trim());
    if (studentSearch.trim()) nextParams.set('student_search', studentSearch.trim());
    if (attemptStatus) nextParams.set('attempt_status', attemptStatus);
    if (resultStatus) nextParams.set('result_status', resultStatus);
    if (manualOnly) nextParams.set('manual_only', '1');
    if (fromLocal) nextParams.set('from_local', fromLocal);
    if (toLocal) nextParams.set('to_local', toLocal);
    setParams(nextParams);
    setOffset(0);
  };

  const totalPages = Math.max(1, Math.ceil(payload.total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  const examColumns = [
    {
      key: 'name',
      header: 'Экзамен',
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.status}</p>
        </div>
      ),
    },
    {
      key: 'author',
      header: 'Автор',
      cell: (row) => row.created_by_name || '—',
    },
    {
      key: 'assigner',
      header: 'Назначил',
      cell: (row) => row.primary_assigner_name || '—',
    },
    {
      key: 'counts',
      header: 'Назн. / попытки',
      cell: (row) =>
        `${row.assignment_count} / ${row.attempt_count} (сдано ${row.submitted_attempt_count})`,
    },
    {
      key: 'results',
      header: 'Результаты',
      cell: (row) =>
        `✓${row.passed_count} · ✗${row.failed_count} · ⏳${row.pending_review_count}`,
    },
    {
      key: 'manual',
      header: 'Ручные',
      cell: (row) =>
        row.manual_score_count > 0 ? (
          <span className="text-amber-700 dark:text-amber-300">
            {row.manual_score_count}
          </span>
        ) : (
          '0'
        ),
    },
    {
      key: 'created',
      header: 'Создан',
      cell: (row) => formatDateTime(row.created_at),
    },
  ];

  const attemptColumns = [
    {
      key: 'exam',
      header: 'Экзамен',
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{row.exam_name}</p>
          <p className="text-xs text-muted-foreground">
            попытка #{row.attempt_number}
          </p>
        </div>
      ),
    },
    {
      key: 'student',
      header: 'Ученик',
      cell: (row) => row.student_name || '—',
    },
    {
      key: 'assigner',
      header: 'Назначил',
      cell: (row) => row.assigned_by_name || '—',
    },
    {
      key: 'attempt_status',
      header: 'Попытка',
      cell: (row) => row.attempt_status,
    },
    {
      key: 'result',
      header: 'Результат',
      cell: (row) =>
        row.result_status ? (
          <ResultStatusBadge status={row.result_status} />
        ) : (
          '—'
        ),
    },
    {
      key: 'score',
      header: 'Балл',
      cell: (row) =>
        row.score != null ? (
          <span>
            {row.score}/{row.max_score}
            {row.has_manual_score ? (
              <span className="ml-1 text-xs text-amber-700 dark:text-amber-300">
                ручн.
              </span>
            ) : null}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'when',
      header: 'Дата',
      cell: (row) =>
        formatDateTime(row.submitted_at || row.started_at || row.created_at),
    },
  ];

  return (
    <div
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6"
      data-testid="admin-exam-registry"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to={createPageUrl('AdminAssessment')}
            className="text-xs text-muted-foreground hover:text-brand"
          >
            ← Проверочные работы
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Экзамены</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Реестр всех экзаменов и попыток учеников (только администратор)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'attempts'} onClick={() => setTab('attempts')}>
          Попытки
        </TabButton>
        <TabButton active={tab === 'exams'} onClick={() => setTab('exams')}>
          Экзамены
        </TabButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <Input
          placeholder={tab === 'exams' ? 'Название экзамена' : 'Экзамен'}
          value={examSearch}
          onChange={(e) => setExamSearch(e.target.value)}
        />
        {tab === 'attempts' && (
          <>
            <Input
              placeholder="Ученик"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={attemptStatus}
              onChange={(e) => setAttemptStatus(e.target.value)}
            >
              <option value="">Все статусы попытки</option>
              <option value="created">created</option>
              <option value="started">started</option>
              <option value="submitted">submitted</option>
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={resultStatus}
              onChange={(e) => setResultStatus(e.target.value)}
            >
              <option value="">Все статусы результата</option>
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
            />
            <Input
              type="datetime-local"
              value={toLocal}
              onChange={(e) => setToLocal(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <input
                type="checkbox"
                checked={manualOnly}
                onChange={(e) => setManualOnly(e.target.checked)}
              />
              Только ручная оценка
            </label>
          </>
        )}
        <Button onClick={applyFilters}>
          <Search className="h-4 w-4 mr-2" />
          Найти
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200">
          {error.message || 'Не удалось загрузить реестр'}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : payload.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Ничего не найдено
        </div>
      ) : tab === 'exams' ? (
        <ResponsiveTable
          columns={examColumns}
          rows={payload.items}
          rowKey={(row) => row.id}
          onRowClick={(row) =>
            navigate(`${createPageUrl('AssessmentExamDetail')}?id=${row.id}`)
          }
          actions={(row) => (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                navigate(
                  `${createPageUrl('AdminExamRegistry')}?tab=attempts&exam_search=${encodeURIComponent(row.name || '')}`,
                );
                setTab('attempts');
                setExamSearch(row.name || '');
                setOffset(0);
              }}
            >
              Попытки
            </Button>
          )}
        />
      ) : (
        <ResponsiveTable
          columns={attemptColumns}
          rows={payload.items}
          rowKey={(row) => row.attempt_id}
          onRowClick={(row) =>
            navigate(
              `${createPageUrl('AdminExamAttemptDetail')}?attemptId=${row.attempt_id}`,
            )
          }
          actions={(row) => (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                navigate(
                  `${createPageUrl('AdminExamAttemptDetail')}?attemptId=${row.attempt_id}`,
                );
              }}
            >
              Открыть
            </Button>
          )}
        />
      )}

      {payload.total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            Всего: {payload.total} · стр. {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset <= 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= payload.total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Вперёд
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
