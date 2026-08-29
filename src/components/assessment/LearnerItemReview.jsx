import { MessageCircle } from 'lucide-react';
import { Caption } from '@/design-system';
import { iconSize } from '@/design-system/tokens/icon';
import { homeworkItemReviewHasContent } from '@/lib/homework-item-review';

/**
 * Student-facing review under an answer: verdict/score, teacher comment, expected answer.
 * Renders nothing when there is no comment, score, or allowed expected answer.
 */
export default function LearnerItemReview({ review }) {
  if (!homeworkItemReviewHasContent(review)) return null;

  const comment = review.comment;
  const expected = review.expectedAnswer;
  const earned = review.earnedPoints;
  const max = review.maxPoints;
  const isCorrect = review.isCorrect;

  let verdict = null;
  if (isCorrect === true) verdict = { label: 'Верно', className: 'text-emerald-700 dark:text-emerald-400' };
  else if (isCorrect === false)
    verdict = { label: 'Неверно', className: 'text-red-700 dark:text-red-400' };
  else if (earned != null && max != null && Number(max) > 0 && Number(earned) > 0 && Number(earned) < Number(max)) {
    verdict = { label: 'Частично', className: 'text-amber-700 dark:text-amber-300' };
  }

  return (
    <div
      className="space-y-2 min-w-0 overflow-x-hidden"
      data-testid="homework-item-review"
    >
      {verdict || earned != null ? (
        <div className="text-sm text-foreground" data-testid="homework-item-score">
          {verdict ? (
            <p className={`font-medium ${verdict.className}`}>
              {isCorrect === false ? '❌ ' : isCorrect === true ? '✓ ' : ''}
              {verdict.label}
            </p>
          ) : null}
          {earned != null ? (
            <p className="mt-0.5">
              {earned} / {max ?? '—'} балла
            </p>
          ) : null}
        </div>
      ) : null}

      {comment ? (
        <div
          className="min-w-0 rounded-lg bg-brand-soft/60 px-3 py-2"
          data-testid="homework-item-teacher-comment"
        >
          <p className="flex items-start gap-2 text-sm font-medium text-foreground min-w-0">
            <MessageCircle className={`${iconSize.sm} mt-0.5 shrink-0 text-brand`} aria-hidden />
            <span>Комментарий преподавателя</span>
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0">
            {comment}
          </p>
        </div>
      ) : null}

      {expected ? (
        <div data-testid="homework-student-expected-answer" className="min-w-0">
          <Caption>Эталонный ответ</Caption>
          <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0">
            {expected}
          </p>
        </div>
      ) : null}
    </div>
  );
}
