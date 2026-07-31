/**
 * Helpers for student Assessment UI: status, flattening snapshots, answer payloads.
 */

export const EXAM_UI_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

export const EXAM_UI_STATUS_LABEL = {
  [EXAM_UI_STATUS.NOT_STARTED]: 'Не начат',
  [EXAM_UI_STATUS.IN_PROGRESS]: 'В процессе',
  [EXAM_UI_STATUS.COMPLETED]: 'Завершён',
};

export function unwrapItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export function resolveExamCardStatus(attemptsForExam = []) {
  const hasStarted = attemptsForExam.some((a) => a.status === 'started');
  if (hasStarted) return EXAM_UI_STATUS.IN_PROGRESS;
  const hasSubmitted = attemptsForExam.some((a) => a.status === 'submitted');
  if (hasSubmitted) return EXAM_UI_STATUS.COMPLETED;
  return EXAM_UI_STATUS.NOT_STARTED;
}

export function findLiveAttempt(attemptsForExam = []) {
  return attemptsForExam.find((a) => a.status === 'started') || null;
}

export function findLatestSubmittedAttempt(attemptsForExam = []) {
  const submitted = attemptsForExam.filter((a) => a.status === 'submitted');
  if (submitted.length === 0) return null;
  return [...submitted].sort((a, b) => {
    const ta = new Date(a.submitted_at || a.updated_at || 0).getTime();
    const tb = new Date(b.submitted_at || b.updated_at || 0).getTime();
    return tb - ta;
  })[0];
}

/** Flatten AttemptState sections into ordered questions. */
export function flattenAttemptQuestions(state) {
  const sections = Array.isArray(state?.sections) ? state.sections : [];
  const questions = [];
  sections.forEach((section) => {
    (section.questions || []).forEach((q) => {
      questions.push({
        ...q,
        section_key: section.section_key,
        section_title: section.title,
      });
    });
  });
  return questions;
}

export function isQuestionAnswered(localAnswer) {
  if (!localAnswer) return false;
  const selected = localAnswer.selected_answer_snapshot_ids || [];
  const text = (localAnswer.text || '').trim();
  const hasAudio = Boolean(localAnswer.has_audio || localAnswer.audio_url);
  return selected.length > 0 || text.length > 0 || hasAudio;
}

export function buildAutosavePayload(questionSnapshotId, localAnswer) {
  return {
    question_snapshot_id: questionSnapshotId,
    selected_answer_snapshot_ids: localAnswer?.selected_answer_snapshot_ids || [],
    text: localAnswer?.text ?? null,
  };
}

export function formatCountdown(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function resultStatusLabel(result) {
  if (!result) return null;
  if (result.status === 'pending_review' || result.status === 'processing') {
    return 'pending_review';
  }
  if (result.passed === true || result.status === 'passed') return 'passed';
  if (result.passed === false || result.status === 'failed') return 'failed';
  return result.status;
}
