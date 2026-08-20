import { useState } from 'react';
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
import { useTeacherAssessmentCards } from '@/hooks/useTeacherAssessment';
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

export default function TeacherAssessment() {
  const { cards, loading, error, reload } = useTeacherAssessmentCards();
  const [assignOpen, setAssignOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const pendingReview = cards.filter((c) => c.resultStatus === 'pending_review');
  const reviewed = cards.filter(
    (c) => c.resultStatus === 'final' || c.resultStatus === 'published',
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-brand dark:text-brand mb-1">
            <ClipboardList className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Экзамены</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Мои экзамены</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Назначьте экзамен ученику, отслеживайте сдачу и проверку
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
            <Link to={createPageUrl('TeacherAssessmentReview')}>
              <FileSearch className="h-4 w-4 mr-2" />
              На проверке
              {pendingReview.length > 0 ? ` (${pendingReview.length})` : ''}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={createPageUrl('TeacherAssessmentResults')}>
              <Trophy className="h-4 w-4 mr-2" />
              Результаты
              {reviewed.length > 0 ? ` (${reviewed.length})` : ''}
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
        </div>
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

      {!error && cards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/80 dark:bg-slate-900/40 p-10 text-center space-y-3">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
            Пока нет назначенных экзаменов
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Нажмите «Назначить экзамен», выберите ученика и опубликованный экзамен.
          </p>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => setAssignOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Назначить экзамен
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {cards.map((card) => (
          <article
            key={card.assignment.id}
            className="rounded-2xl border border-border bg-card/80 p-5 sm:p-6 shadow-sm"
            data-testid={`teacher-exam-card-${card.assignment.id}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className="text-lg font-semibold text-foreground truncate">
                  {card.examName}
                </h2>
                {card.exam?.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {card.exam.description}
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">{card.studentName}</p>
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
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
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
            </div>
          </article>
        ))}
      </div>

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
