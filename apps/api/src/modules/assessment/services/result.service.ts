import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  AssessmentAttemptEntity,
  AssessmentResultBreakdownEntity,
  AssessmentResultEntity,
} from '../entities';
import { EvaluationType, QuestionType, ResultStatus, isManualReviewQuestionType } from '../enums';
import {
  ASSESSMENT_RESULT_PASSED,
  ASSESSMENT_RESULT_PENDING_REVIEW,
  ASSESSMENT_RESULT_REVIEWED,
} from '../events/assessment-result.events';
import {
  AssessmentAttemptRepository,
  AssessmentExamRepository,
  AssessmentResultRepository,
} from '../repositories';
import { AssessmentContentGuard } from './assessment-content.guard';
import { toResultDto } from './result-dto';
import { AssessmentScoringService } from './assessment-scoring.service';

export type CreateResultInput = {
  evaluationType?: EvaluationType;
  requiresManualReview?: boolean;
};

export type ReviewAnswerInput = {
  questionSnapshotId: string;
  score: number;
  comment?: string | null;
};

export type ReviewItemView = {
  questionSnapshotId: string;
  attemptAnswerId: string | null;
  sectionKey: string;
  type: QuestionType;
  stem: string;
  points: number;
  explanation: string | null;
  textAnswer: string | null;
  hasAudio: boolean;
  audioUrl: string | null;
  audioMime: string | null;
  audioOriginalFilename: string | null;
  audioDurationMs: number | null;
  selectedAnswerSnapshotIds: string[];
  answerOptions: Array<{ snapshotId: string; text: string }>;
  requiresManualReview: boolean;
  score: number | null;
  reviewComment: string | null;
  isCorrect: boolean | null;
};

export type ReviewBundle = {
  result: AssessmentResultEntity;
  reviewStatus: 'not_reviewed' | 'in_progress' | 'reviewed';
  items: ReviewItemView[];
  manualPendingCount: number;
};

@Injectable()
export class ResultService {
  constructor(
    private readonly results: AssessmentResultRepository,
    private readonly attempts: AssessmentAttemptRepository,
    private readonly exams: AssessmentExamRepository,
    private readonly scoring: AssessmentScoringService,
    private readonly guard: AssessmentContentGuard,
    private readonly access: AssessmentAccessService,
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  findById(id: string): Promise<AssessmentResultEntity | null> {
    return this.results.findById(id);
  }

  async getForActor(
    id: string,
    actor: DomainAccessActor,
  ): Promise<ReturnType<typeof toResultDto>> {
    const result = await this.access.assertCanReadResult(actor, id);
    const withBreakdowns =
      (await this.results.findByAttemptId(result.attemptId)) ?? result;
    return toResultDto(withBreakdowns);
  }

  findByAttemptId(attemptId: string): Promise<AssessmentResultEntity | null> {
    return this.results.findByAttemptId(attemptId);
  }

  async getByAttemptForActor(
    attemptId: string,
    actor: DomainAccessActor,
  ): Promise<ReturnType<typeof toResultDto>> {
    await this.access.assertCanViewResults(actor, attemptId);
    const result = this.guard.requireFound(
      await this.results.findByAttemptId(attemptId),
      'Result',
    );
    return toResultDto(result);
  }

  async listFiltered(
    filter: {
      examId?: string;
      studentId?: string;
      teacherId?: string;
      passed?: boolean;
      from?: string;
      to?: string;
    } = {},
    actor?: DomainAccessActor,
  ): Promise<AssessmentResultEntity[]> {
    let items = filter.examId
      ? await this.results.filterByExamId(filter.examId)
      : await this.results.findAll();

    if (
      filter.studentId ||
      filter.teacherId ||
      filter.passed !== undefined ||
      filter.from ||
      filter.to
    ) {
      const filtered: AssessmentResultEntity[] = [];
      for (const result of items) {
        const attempt = await this.attempts.findById(result.attemptId);
        if (!attempt) continue;

        if (filter.studentId && attempt.studentId !== filter.studentId) continue;
        if (filter.teacherId && attempt.teacherId !== filter.teacherId) continue;
        if (filter.passed !== undefined && result.passed !== filter.passed) continue;

        const finishedAt = result.finishedAt ?? result.createdAt;
        if (filter.from) {
          const from = new Date(filter.from);
          if (finishedAt.getTime() < from.getTime()) continue;
        }
        if (filter.to) {
          const to = new Date(filter.to);
          if (finishedAt.getTime() > to.getTime()) continue;
        }

        filtered.push(result);
      }
      items = filtered;
    }

    if (actor) {
      items = await this.access.filterReadableResults(actor, items);
    }

    return items;
  }

  /**
   * Create Result after Attempt is submitted.
   * Flow: processing → pending_review | passed | failed.
   * Automatic rescoring of finalized Result is forbidden.
   */
  async createForSubmittedAttempt(
    attempt: AssessmentAttemptEntity,
    options: CreateResultInput = {},
  ): Promise<AssessmentResultEntity> {
    const existing = await this.results.findByAttemptId(attempt.id);
    if (existing) {
      this.assertCannotAutomaticallyRescore(existing);
      throw new ConflictException('Result already exists for this Attempt');
    }

    const exam = this.guard.requireFound(
      await this.exams.findWithStructure(attempt.examId),
      'Exam',
    );
    const rule = exam.rule ?? (await this.exams.findRuleByExamId(exam.id));

    const sectionWeights = new Map(
      (exam.sections ?? []).map((s) => [s.sectionKey, String(s.weight)]),
    );

    const scored = await this.scoring.scoreAttempt(attempt.id, sectionWeights, rule);

    const evaluationType = options.evaluationType ?? scored.evaluationType;
    const needsReview =
      options.requiresManualReview === true || scored.requiresManualReview;

    await this.persistAutoAnswerScores(scored.questions);

    const finishedAt = attempt.submittedAt ?? new Date();
    const startedAt = attempt.startedAt;
    const duration =
      startedAt && finishedAt
        ? Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000))
        : null;

    const breakdowns: Partial<AssessmentResultBreakdownEntity>[] = scored.sections.map(
      (section) => ({
        sectionKey: section.sectionKey,
        weight: section.weight,
        score: String(section.score),
        maxScore: String(section.maxScore),
      }),
    );

    const processing = await this.results.saveWithBreakdowns(
      {
        attemptId: attempt.id,
        examId: attempt.examId,
        status: ResultStatus.Processing,
        evaluationType,
        score: String(scored.score),
        maxScore: String(scored.maxScore),
        percent: scored.percent.toFixed(2),
        passed: false,
        startedAt,
        finishedAt,
        duration,
        attemptNumber: attempt.attemptNumber,
      },
      breakdowns,
    );

    const nextStatus = needsReview
      ? ResultStatus.PendingReview
      : scored.passed
        ? ResultStatus.Passed
        : ResultStatus.Failed;

    const finalized = await this.results.update(processing.id, {
      status: nextStatus,
      passed: needsReview ? false : scored.passed,
      evaluationType,
    });

    const result = this.guard.requireFound(finalized, 'Result');

    if (result.status === ResultStatus.Passed) {
      this.events?.emit(ASSESSMENT_RESULT_PASSED, result);
    } else if (result.status === ResultStatus.PendingReview) {
      this.events?.emit(ASSESSMENT_RESULT_PENDING_REVIEW, result);
    }

    return result;
  }

  /**
   * Teacher/admin review payload for a Result pending (or after) manual review.
   * Reuses ACL via assertCanReadResult; students cannot open review workspace.
   */
  async getReviewBundle(
    resultId: string,
    actor: DomainAccessActor,
  ): Promise<ReviewBundle> {
    this.assertCanPerformReview(actor);
    const result = await this.access.assertCanReadResult(actor, resultId);
    const items = await this.buildReviewItems(result.attemptId);
    return {
      result,
      reviewStatus: this.resolveReviewStatus(result, items),
      items,
      manualPendingCount: items.filter(
        (i) => i.requiresManualReview && i.score == null,
      ).length,
    };
  }

  /**
   * Persist teacher scores/comments for manual questions. Result stays pending_review.
   */
  async saveReview(
    resultId: string,
    actor: DomainAccessActor,
    answers: ReviewAnswerInput[],
  ): Promise<ReviewBundle> {
    this.assertCanPerformReview(actor);
    const result = await this.access.assertCanReadResult(actor, resultId);
    this.assertPendingReview(result);

    const qSnaps = await this.attempts.findQuestionSnapshotsByAttemptId(
      result.attemptId,
    );
    const qById = new Map(qSnaps.map((q) => [q.id, q]));
    const existingAnswers = await this.attempts.findAttemptAnswersByAttemptId(
      result.attemptId,
    );
    const answerByQ = new Map(existingAnswers.map((a) => [a.questionSnapshotId, a]));

    const now = new Date();

    for (const row of answers) {
      const qSnap = qById.get(row.questionSnapshotId);
      if (!qSnap) {
        throw new BadRequestException(
          `Unknown question snapshot: ${row.questionSnapshotId}`,
        );
      }
      if (!isManualReviewQuestionType(qSnap.type)) {
        throw new BadRequestException(
          'Only text/speaking answers can be scored during manual review',
        );
      }

      const maxPoints = Number(qSnap.points);
      if (row.score < 0 || row.score > maxPoints) {
        throw new BadRequestException(
          `Score must be between 0 and ${maxPoints} for this question`,
        );
      }

      const isCorrect =
        row.score >= maxPoints ? true : row.score <= 0 ? false : null;
      const comment =
        row.comment === undefined
          ? undefined
          : row.comment == null || row.comment.trim() === ''
            ? null
            : row.comment.trim();

      const existing = answerByQ.get(row.questionSnapshotId);
      if (existing) {
        await this.attempts.updateAttemptAnswer(existing.id, {
          score: String(row.score),
          isCorrect,
          ...(comment !== undefined ? { reviewComment: comment } : {}),
          reviewedByUserId: actor.sub,
          reviewedAt: now,
        });
      } else {
        const created = await this.attempts.saveAttemptAnswer({
          attemptId: result.attemptId,
          questionSnapshotId: row.questionSnapshotId,
          textAnswer: null,
          score: String(row.score),
          isCorrect,
          reviewComment: comment === undefined ? null : comment,
          reviewedByUserId: actor.sub,
          reviewedAt: now,
        });
        answerByQ.set(row.questionSnapshotId, created);
      }
    }

    const items = await this.buildReviewItems(result.attemptId);
    return {
      result,
      reviewStatus: this.resolveReviewStatus(result, items),
      items,
      manualPendingCount: items.filter(
        (i) => i.requiresManualReview && i.score == null,
      ).length,
    };
  }

  /**
   * Finalize manual review: pending_review → passed | failed.
   * Recalculates score / max_score / percent from answer scores.
   */
  async finalizeReview(
    resultId: string,
    actor: DomainAccessActor,
  ): Promise<AssessmentResultEntity> {
    this.assertCanPerformReview(actor);
    const result = await this.access.assertCanReadResult(actor, resultId);
    this.assertPendingReview(result);

    const attempt = this.guard.requireFound(
      await this.attempts.findById(result.attemptId),
      'Attempt',
    );
    const exam = this.guard.requireFound(
      await this.exams.findWithStructure(attempt.examId),
      'Exam',
    );
    const rule = exam.rule ?? (await this.exams.findRuleByExamId(exam.id));
    const sectionWeights = new Map(
      (exam.sections ?? []).map((s) => [s.sectionKey, String(s.weight)]),
    );

    const qSnaps = await this.attempts.findQuestionSnapshotsByAttemptId(attempt.id);
    const attemptAnswers = await this.attempts.findAttemptAnswersByAttemptId(
      attempt.id,
    );
    const answerByQ = new Map(attemptAnswers.map((a) => [a.questionSnapshotId, a]));

    for (const qSnap of qSnaps) {
      if (!isManualReviewQuestionType(qSnap.type)) continue;
      const ans = answerByQ.get(qSnap.id);
      if (!ans || ans.score == null || ans.score === '') {
        throw new BadRequestException(
          'All manual questions must be scored before finishing review',
        );
      }
    }

    const sectionScores = new Map<
      string,
      { sectionKey: string; weight: string; score: number; maxScore: number }
    >();
    for (const [sectionKey, weight] of sectionWeights.entries()) {
      sectionScores.set(sectionKey, {
        sectionKey,
        weight,
        score: 0,
        maxScore: 0,
      });
    }

    let totalScore = 0;
    let totalMax = 0;

    for (const qSnap of qSnaps) {
      const points = Number(qSnap.points);
      let bucket = sectionScores.get(qSnap.sectionKey);
      if (!bucket) {
        bucket = {
          sectionKey: qSnap.sectionKey,
          weight: sectionWeights.get(qSnap.sectionKey) ?? '0',
          score: 0,
          maxScore: 0,
        };
        sectionScores.set(qSnap.sectionKey, bucket);
      }
      bucket.maxScore += points;
      totalMax += points;

      const ans = answerByQ.get(qSnap.id);
      let earned = 0;

      if (isManualReviewQuestionType(qSnap.type)) {
        earned = Number(ans?.score ?? 0);
      } else if (ans?.score != null && ans.score !== '') {
        earned = Number(ans.score);
      } else {
        const selectedIds = ans
          ? await this.attempts.findSelectedAnswerSnapshotIds(ans.id)
          : [];
        const answerSnaps =
          await this.attempts.findAnswerSnapshotsByQuestionSnapshotId(qSnap.id);
        const scored = this.scoring.scoreAutoQuestion(
          qSnap,
          answerSnaps,
          selectedIds,
          points,
        );
        earned = scored.earned;
        if (ans) {
          await this.attempts.updateAttemptAnswer(ans.id, {
            score: String(scored.earned),
            isCorrect: scored.isCorrect,
          });
        }
      }

      bucket.score += earned;
      totalScore += earned;
    }

    const percent = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
    const passed = this.scoring.resolvePassed(totalScore, percent, rule);
    const nextStatus = passed ? ResultStatus.Passed : ResultStatus.Failed;

    const breakdowns: Partial<AssessmentResultBreakdownEntity>[] = [
      ...sectionScores.values(),
    ].map((section) => ({
      sectionKey: section.sectionKey,
      weight: section.weight,
      score: String(section.score),
      maxScore: String(section.maxScore),
    }));

    const updated = await this.results.updateWithBreakdowns(
      result.id,
      {
        status: nextStatus,
        passed,
        score: String(totalScore),
        maxScore: String(totalMax),
        percent: percent.toFixed(2),
      },
      breakdowns,
    );

    if (updated.status === ResultStatus.Passed) {
      this.events?.emit(ASSESSMENT_RESULT_PASSED, updated);
    }
    this.events?.emit(ASSESSMENT_RESULT_REVIEWED, updated);

    return updated;
  }

  assertCannotAutomaticallyRescore(result: AssessmentResultEntity): void {
    if (
      result.status === ResultStatus.Passed ||
      result.status === ResultStatus.Failed ||
      result.status === ResultStatus.Invalidated ||
      result.status === ResultStatus.PendingReview
    ) {
      throw new ConflictException(
        'Submitted Attempt Result cannot be rescored automatically',
      );
    }
  }

  private assertCanPerformReview(actor: DomainAccessActor): void {
    if (
      this.access.isAdmin(actor) ||
      this.access.isTeacher(actor) ||
      this.access.isTutor(actor)
    ) {
      return;
    }
    throw new ForbiddenException(
      'Forbidden: only the assigning teacher/tutor or admin can review results',
    );
  }

  private assertPendingReview(result: AssessmentResultEntity): void {
    if (result.status !== ResultStatus.PendingReview) {
      throw new ConflictException(
        'Only results awaiting review can be scored or finalized',
      );
    }
  }

  private resolveReviewStatus(
    result: AssessmentResultEntity,
    items: ReviewItemView[],
  ): ReviewBundle['reviewStatus'] {
    if (
      result.status === ResultStatus.Passed ||
      result.status === ResultStatus.Failed
    ) {
      return 'reviewed';
    }
    const manual = items.filter((i) => i.requiresManualReview);
    if (manual.length === 0) {
      return result.status === ResultStatus.PendingReview
        ? 'not_reviewed'
        : 'reviewed';
    }
    const scored = manual.filter((i) => i.score != null).length;
    if (scored === 0) return 'not_reviewed';
    if (scored < manual.length) return 'in_progress';
    return result.status === ResultStatus.PendingReview
      ? 'in_progress'
      : 'reviewed';
  }

  private async buildReviewItems(attemptId: string): Promise<ReviewItemView[]> {
    const qSnaps = await this.attempts.findQuestionSnapshotsByAttemptId(attemptId);
    const attemptAnswers =
      await this.attempts.findAttemptAnswersByAttemptId(attemptId);
    const answerByQ = new Map(attemptAnswers.map((a) => [a.questionSnapshotId, a]));
    const items: ReviewItemView[] = [];

    for (const qSnap of qSnaps) {
      const attemptAnswer = answerByQ.get(qSnap.id) ?? null;
      const selectedIds = attemptAnswer
        ? await this.attempts.findSelectedAnswerSnapshotIds(attemptAnswer.id)
        : [];
      const answerSnaps =
        await this.attempts.findAnswerSnapshotsByQuestionSnapshotId(qSnap.id);
      const requiresManualReview = isManualReviewQuestionType(qSnap.type);
      const hasAudio = Boolean(attemptAnswer?.audioStorageKey);

      items.push({
        questionSnapshotId: qSnap.id,
        attemptAnswerId: attemptAnswer?.id ?? null,
        sectionKey: qSnap.sectionKey,
        type: qSnap.type,
        stem: qSnap.stem,
        points: Number(qSnap.points),
        explanation: qSnap.explanation ?? null,
        textAnswer: attemptAnswer?.textAnswer ?? null,
        hasAudio,
        audioUrl: hasAudio
          ? `/api/assessment/attempts/${attemptId}/answers/${attemptAnswer!.id}/audio`
          : null,
        audioMime: attemptAnswer?.audioMime ?? null,
        audioOriginalFilename: attemptAnswer?.audioOriginalFilename ?? null,
        audioDurationMs: attemptAnswer?.audioDurationMs ?? null,
        selectedAnswerSnapshotIds: selectedIds,
        answerOptions: answerSnaps.map((a) => ({
          snapshotId: a.id,
          text: a.text,
        })),
        requiresManualReview,
        score:
          attemptAnswer?.score != null && attemptAnswer.score !== ''
            ? Number(attemptAnswer.score)
            : null,
        reviewComment: attemptAnswer?.reviewComment ?? null,
        isCorrect: attemptAnswer?.isCorrect ?? null,
      });
    }

    return items;
  }

  private async persistAutoAnswerScores(
    questions: Awaited<ReturnType<AssessmentScoringService['scoreAttempt']>>['questions'],
  ): Promise<void> {
    for (const row of questions) {
      if (!row.attemptAnswerId || row.requiresManualReview) {
        continue;
      }
      await this.attempts.updateAttemptAnswer(row.attemptAnswerId, {
        isCorrect: row.isCorrect,
        score: String(row.earnedPoints),
      });
    }
  }
}
