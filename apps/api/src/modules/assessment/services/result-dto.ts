import { AssessmentResultBreakdownEntity, AssessmentResultEntity } from '../entities';

/** Plain JSON-safe result DTOs (no TypeORM relation cycles). */
export function toResultBreakdownDto(b: AssessmentResultBreakdownEntity) {
  return {
    id: b.id,
    result_id: b.resultId,
    section_key: b.sectionKey,
    sectionKey: b.sectionKey,
    weight: b.weight,
    score: b.score,
    max_score: b.maxScore,
    maxScore: b.maxScore,
  };
}

export function toResultDto(result: AssessmentResultEntity) {
  const breakdowns = (result.breakdowns ?? [])
    .filter((b): b is AssessmentResultBreakdownEntity => Boolean(b))
    .map(toResultBreakdownDto);
  return {
    id: result.id,
    attempt_id: result.attemptId,
    exam_id: result.examId,
    status: result.status,
    evaluation_type: result.evaluationType,
    score: result.score,
    max_score: result.maxScore,
    percent: result.percent,
    passed: result.passed,
    started_at: result.startedAt,
    finished_at: result.finishedAt,
    duration: result.duration,
    attempt_number: result.attemptNumber,
    created_at: result.createdAt,
    updated_at: result.updatedAt,
    breakdowns,
  };
}
