/**
 * Map homework attempt answers onto per-question student review props.
 * Keys are question snapshot ids. Empty teacher comments stay null (no empty UI).
 */
export function buildHomeworkItemReviews(questions = [], answers = []) {
  const byId = new Map(
    (answers || []).map((row) => [row.question_snapshot_id, row]),
  );
  const reviews = {};
  for (const question of questions || []) {
    const id = question.id || question.snapshot_id;
    if (!id) continue;
    const answer = byId.get(id) || byId.get(question.snapshot_id);
    const comment =
      typeof answer?.review_comment === 'string' ? answer.review_comment.trim() : '';
    const expected =
      typeof question.explanation === 'string' ? question.explanation.trim() : '';
    reviews[id] = {
      comment: comment || null,
      earnedPoints: answer?.earned_points ?? null,
      maxPoints: question.points ?? null,
      isCorrect: answer?.is_correct ?? null,
      expectedAnswer: expected || null,
    };
  }
  return reviews;
}

export function homeworkItemReviewHasContent(review) {
  if (!review) return false;
  return Boolean(
    review.comment ||
      review.expectedAnswer ||
      review.earnedPoints != null ||
      review.isCorrect === true ||
      review.isCorrect === false,
  );
}
