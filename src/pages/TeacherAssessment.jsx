import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  FileSearch,
  Loader2,
  Plus,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResultStatusBadge } from '@/components/assessment/StatusBadges';
import AssignmentCreateDialog from '@/components/assessment/AssignmentCreateDialog';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import {
  useTeacherAssessmentCards,
  filterExamResults,
  isExamResultCompleted,
  isExamResultPending,
  isTeacherExamAssignmentCurrent,
} from '@/hooks/useTeacherAssessment';
import {
  RESULT_STATUS_LABEL,
  formatDateTime,
} from '@/lib/assessment-admin';

const ASSIGNMENT_STATUS_LABEL = {
  draft: 'Черновик',
  active: 'Назначен',
  cancelled: 'Отменено',
  expired: 'Истекло',
  scheduled: 'Запланировано',
  completed: 'Завершён',
};

const WORK_TABS = [
  { id: 'current', label: 'Текущие', shortLabel: 'Текущие' },
  { id: 'pending', label: 'На проверке', shortLabel: 'Проверка' },
  { id: 'completed', label: 'Завершённые', shortLabel: 'Готовые' },
  { id: 'all', label: 'Все', shortLabel: 'Все' },
];

function openReviewUrl(resultId) {
  return `${createPageUrl('TeacherAssessmentReviewDetail')}?id=${encodeURIComponent(resultId)}`;
}

export default function TeacherAssessment() {
  const { cards, results, loading, error, reload } = useTeacherAssessmentCards();
  const [assignOpen, setAssignOpen] = useState(false);
  const [tab, setTab] = useState('all');

  const pendingResults = useMemo(
    () => filterExamResults(results, 'pending'),
    [results],
  );
  const completedResults = useMemo(
    () => filterExamResults(results, 'completed'),
    [results],
  );
  const currentCards = useMemo(
    () => cards.filter(isTeacherExamAssignmentCurrent),
    [cards],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div
      className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 min-w-0 overflow-x-hidden"
      data-testid="teacher-assessment-hub"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-brand dark:text-brand mb-1">
            <ClipboardList className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Экзамены</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Мои экзамены</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Назначения, проверка и постоянная история результатов учеников
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-primary hover:bg-primary/90"
            size="sm"
            onClick={() => setAssignOpen(true)}
            data-testid="teacher-assign-exam"
          >
            <Plus className="h-4 w-4 mr-2" />
            Назначить экзамен
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={createPageUrl('TeacherAssessmentResults')}>
              <Trophy className="h-4 w-4 mr-2" />
              Журнал
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
        </div>
      </div>

      <div
        className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 border-b border-border pb-2 min-w-0"
        data-testid="teacher-exam-work-tabs"
      >
        {WORK_TABS.map((item) => {
          const active = tab === item.id;
          const badge =
            item.id === 'current'
              ? currentCards.length
              : item.id === 'pending'
                ? pendingResults.length
                : item.id === 'completed'
                  ? completedResults.length
                  : results.length;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex min-h-11 sm:min-h-10 items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm transition min-w-0 ${
                active
                  ? 'bg-brand/10 text-brand font-medium'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              data-testid={`teacher-exam-tab-${item.id}`}
            >
              <span className="truncate sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline truncate">{item.label}</span>
              <span className="text-xs opacity-70 shrink-0">{badge}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <p className="font-medium">Не удалось загрузить экзамены</p>
          <p className="mt-1 opacity-90">{error.message || 'Ошибка сети'}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => reload()}>
            Повторить
          </Button>
        </div>
      )}

      {!error && tab === 'current' && (
        <AssignmentCards
          cards={currentCards}
          emptyTitle="Нет текущих назначений"
          emptyDescription="Назначьте экзамен ученику — активные назначения появятся здесь."
          onAssign={() => setAssignOpen(true)}
        />
      )}

      {!error && tab === 'pending' && (
        <ResultCards
          rows={pendingResults}
          emptyTitle="Работ на проверку нет"
          emptyDescription="Когда ученик сдаст экзамен с заданиями на проверку, работа появится здесь."
          actionLabel="Проверить"
          actionTestId="teacher-exam-open-pending"
        />
      )}

      {!error && tab === 'completed' && (
        <ResultCards
          rows={completedResults}
          emptyTitle="Завершённых экзаменов пока нет"
          emptyDescription="Проверенные и автоматически оценённые экзамены сохраняются здесь постоянно."
          actionLabel="Открыть разбор"
          actionTestId="teacher-exam-open-completed"
        />
      )}

      {!error && tab === 'all' && (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Назначения</h2>
            <AssignmentCards
              cards={cards}
              emptyTitle="Пока нет назначенных экзаменов"
              emptyDescription="Нажмите «Назначить экзамен», выберите ученика и опубликованный экзамен."
              onAssign={() => setAssignOpen(true)}
            />
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Результаты</h2>
            <ResultCards
              rows={results}
              emptyTitle="Результатов пока нет"
              emptyDescription="После сдачи экзамена результаты появятся в этом списке."
              actionLabel={(row) =>
                isExamResultPending(row)
                  ? 'Проверить'
                  : isExamResultCompleted(row)
                    ? 'Открыть разбор'
                    : 'Открыть'
              }
              actionTestId="teacher-exam-open-all"
            />
          </section>
        </div>
      )}

      <AssignmentCreateDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        mode="teacher"
        onCreated={() => {
          toast({ title: 'Экзамен назначен' });
          reload();
        }}
      />
    </div>
  );
}

function AssignmentCards({ cards, emptyTitle, emptyDescription, onAssign }) {
  if (!cards.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/80 dark:bg-slate-900/40 p-10 text-center space-y-3">
        <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">{emptyTitle}</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{emptyDescription}</p>
        {onAssign ? (
          <Button className="bg-primary hover:bg-primary/90" onClick={onAssign}>
            <Plus className="h-4 w-4 mr-2" />
            Назначить экзамен
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <article
          key={card.assignment.id}
          className="rounded-2xl border border-border bg-card/80 p-5 sm:p-6 shadow-sm min-w-0"
          data-testid={`teacher-exam-card-${card.assignment.id}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
            <div className="min-w-0 space-y-1">
              <h2 className="text-lg font-semibold text-foreground break-words">
                {card.examName}
              </h2>
              {card.exam?.description ? (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {card.exam.description}
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground break-words">{card.studentName}</p>
              <p className="text-xs text-muted-foreground">
                Назначен: {formatDateTime(card.assignment.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                {ASSIGNMENT_STATUS_LABEL[card.assignment.status] ||
                  card.assignment.status}
              </span>
              {card.resultStatus ? (
                <ResultStatusBadge status={card.resultStatus} />
              ) : (
                <span className="text-xs text-muted-foreground">Ожидает сдачи</span>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <p>
                Попыток:{' '}
                <span className="font-semibold text-foreground">{card.attemptCount}</span>
              </p>
              <p>
                Результат:{' '}
                <span className="font-semibold text-foreground">
                  {card.resultStatus
                    ? RESULT_STATUS_LABEL[card.resultStatus] || card.resultStatus
                    : '—'}
                </span>
              </p>
              {card.resultPercent != null ? (
                <p>
                  Балл:{' '}
                  <span className="font-semibold text-foreground">
                    {card.resultScore} / {card.resultMaxScore}
                    {` (${Number(card.resultPercent).toFixed(0)}%)`}
                  </span>
                </p>
              ) : null}
            </div>
            {card.resultId ? (
              <Button asChild size="sm" className="w-full sm:w-auto shrink-0">
                <Link to={openReviewUrl(card.resultId)}>
                  {isExamResultPending({ status: card.resultStatus })
                    ? 'Проверить'
                    : 'Открыть разбор'}
                </Link>
              </Button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function ResultCards({
  rows,
  emptyTitle,
  emptyDescription,
  actionLabel,
  actionTestId,
}) {
  if (!rows.length) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 p-10 text-center space-y-3"
        data-testid="teacher-exam-results-empty"
      >
        <FileSearch className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">{emptyTitle}</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((item) => {
        const label =
          typeof actionLabel === 'function' ? actionLabel(item) : actionLabel;
        return (
          <article
            key={item.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm min-w-0"
            data-testid={`teacher-exam-result-${item.id}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
              <div className="space-y-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground break-words">
                  {item.student_name}
                </h2>
                <p className="text-sm text-muted-foreground break-words">
                  {item.exam_name}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <ResultStatusBadge status={item.status} />
                  <span>
                    {item.score != null
                      ? `${item.score} / ${item.max_score}`
                      : '—'}
                    {item.percent != null
                      ? ` (${Number(item.percent).toFixed(0)}%)`
                      : ''}
                  </span>
                  <span>
                    {formatDateTime(item.finished_at || item.updated_at || item.created_at)}
                  </span>
                </div>
              </div>
              <Button asChild className="bg-primary hover:bg-primary/90 shrink-0 w-full sm:w-auto">
                <Link
                  to={openReviewUrl(item.id)}
                  data-testid={`${actionTestId}-${item.id}`}
                >
                  {label}
                </Link>
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
