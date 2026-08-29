/**
 * Map exam student-feedback API items onto LearnerItemReview props.
 */
export function buildExamItemReview(item) {
  if (!item) return null;
  const comment =
    typeof item.review_comment === 'string' ? item.review_comment.trim() : '';
  const expected =
    typeof item.expected_answer === 'string' ? item.expected_answer.trim() : '';
  return {
    comment: comment || null,
    earnedPoints: item.score != null ? Number(item.score) : null,
    maxPoints: item.points != null ? Number(item.points) : null,
    isCorrect: item.is_correct ?? null,
    expectedAnswer: expected || null,
  };
}

export function formatStudentExamAnswer(item) {
  if (!item) return '—';
  if (item.student_text_answer && String(item.student_text_answer).trim()) {
    return String(item.student_text_answer).trim();
  }
  const selected = Array.isArray(item.selected_option_texts)
    ? item.selected_option_texts.filter(Boolean)
    : [];
  if (selected.length) return selected.join(', ');
  if (item.has_audio) return 'Аудиоответ';
  return 'Нет ответа';
}
