import { Injectable } from '@nestjs/common';
import {
  AssessmentAnswerSnapshotEntity,
  AssessmentQuestionSnapshotEntity,
} from '../entities';
import { EvaluationType, PassingMode, QuestionType, isManualReviewQuestionType } from '../enums';
import { AssessmentAttemptRepository } from '../repositories';

export type QuestionScoreRow = {
  questionSnapshotId: string;
  sectionKey: string;
  type: QuestionType;
  maxPoints: number;
  earnedPoints: number;
  requiresManualReview: boolean;
  isCorrect: boolean | null;
  selectedAnswerSnapshotIds: string[];
  textAnswer: string | null;
  attemptAnswerId: string | null;
};

export type SectionScoreRow = {
  sectionKey: string;
  weight: string;
  score: number;
  maxScore: number;
};

export type AttemptScoreResult = {
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  evaluationType: EvaluationType;
  requiresManualReview: boolean;
  questions: QuestionScoreRow[];
  sections: SectionScoreRow[];
};

export type PassingRuleInput = {
  passingMode?: PassingMode | string | null;
  passScore?: string | number | null;
  passScorePercent?: string | number | null;
};

/** Minimal snapshot shape shared by Exam and Homework runtimes. */
export type ScorableQuestionSnapshot = {
  id: string;
  sectionKey: string;
  type: QuestionType | string;
  points: string | number;
};

export type ScorableAnswerSnapshot = {
  id: string;
  isCorrect: boolean;
};

export type ScorableAttemptAnswer = {
  id: string | null;
  questionSnapshotId: string;
  textAnswer?: string | null;
  selectedAnswerSnapshotIds: string[];
};

export type ScoreFromDataInput = {
  questionSnapshots: ScorableQuestionSnapshot[];
  answers: ScorableAttemptAnswer[];
  answerSnapshotsByQuestionId: Map<string, ScorableAnswerSnapshot[]>;
  sectionWeights?: Map<string, string>;
  passingRule?: PassingRuleInput | null;
};

/**
 * Shared scoring engine for Exam Attempts and Homework Submissions.
 * Loads from AssessmentAttemptRepository only for exam scoreAttempt();
 * Homework (and tests) call scoreFromData() with in-memory snapshots.
 */
@Injectable()
export class AssessmentScoringService {
  constructor(private readonly attempts: AssessmentAttemptRepository) {}

  async scoreAttempt(
    attemptId: string,
    sectionWeights: Map<string, string> = new Map(),
    passingRule?: PassingRuleInput | null,
  ): Promise<AttemptScoreResult> {
    const questionSnapshots =
      await this.attempts.findQuestionSnapshotsByAttemptId(attemptId);
    const attemptAnswers = await this.attempts.findAttemptAnswersByAttemptId(attemptId);

    const answers: ScorableAttemptAnswer[] = [];
    for (const a of attemptAnswers) {
      const selectedIds = await this.attempts.findSelectedAnswerSnapshotIds(a.id);
      answers.push({
        id: a.id,
        questionSnapshotId: a.questionSnapshotId,
        textAnswer: a.textAnswer,
        selectedAnswerSnapshotIds: selectedIds,
      });
    }

    const answerSnapshotsByQuestionId = new Map<string, ScorableAnswerSnapshot[]>();
    for (const qSnap of questionSnapshots) {
      if (isManualReviewQuestionType(qSnap.type)) continue;
      const snaps = await this.attempts.findAnswerSnapshotsByQuestionSnapshotId(qSnap.id);
      answerSnapshotsByQuestionId.set(qSnap.id, snaps);
    }

    return this.scoreFromData({
      questionSnapshots,
      answers,
      answerSnapshotsByQuestionId,
      sectionWeights,
      passingRule,
    });
  }

  /**
   * Pure scoring against provided snapshots — shared by Exam and Homework.
   */
  scoreFromData(input: ScoreFromDataInput): AttemptScoreResult {
    const sectionWeights = input.sectionWeights ?? new Map<string, string>();
    const answerByQ = new Map(input.answers.map((a) => [a.questionSnapshotId, a]));
    const questions: QuestionScoreRow[] = [];
    const sectionScores = new Map<string, SectionScoreRow>();

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
    let autoCount = 0;
    let manualCount = 0;

    for (const qSnap of input.questionSnapshots) {
      const points = Number(qSnap.points);
      const attemptAnswer = answerByQ.get(qSnap.id) ?? null;
      const selectedIds = attemptAnswer?.selectedAnswerSnapshotIds ?? [];

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

      if (isManualReviewQuestionType(qSnap.type)) {
        manualCount += 1;
        questions.push({
          questionSnapshotId: qSnap.id,
          sectionKey: qSnap.sectionKey,
          type: qSnap.type as QuestionType,
          maxPoints: points,
          earnedPoints: 0,
          requiresManualReview: true,
          isCorrect: null,
          selectedAnswerSnapshotIds: selectedIds,
          textAnswer: attemptAnswer?.textAnswer ?? null,
          attemptAnswerId: attemptAnswer?.id ?? null,
        });
        continue;
      }

      autoCount += 1;
      const answerSnaps = input.answerSnapshotsByQuestionId.get(qSnap.id) ?? [];
      const { earned, isCorrect } = this.scoreAutoQuestion(
        qSnap,
        answerSnaps as AssessmentAnswerSnapshotEntity[],
        selectedIds,
        points,
      );

      bucket.score += earned;
      totalScore += earned;

      questions.push({
        questionSnapshotId: qSnap.id,
        sectionKey: qSnap.sectionKey,
        type: qSnap.type as QuestionType,
        maxPoints: points,
        earnedPoints: earned,
        requiresManualReview: false,
        isCorrect,
        selectedAnswerSnapshotIds: selectedIds,
        textAnswer: attemptAnswer?.textAnswer ?? null,
        attemptAnswerId: attemptAnswer?.id ?? null,
      });
    }

    const percent = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
    const passed = this.resolvePassed(totalScore, percent, input.passingRule);
    const evaluationType = this.resolveEvaluationType(autoCount, manualCount);
    const requiresManualReview = manualCount > 0;

    return {
      score: totalScore,
      maxScore: totalMax,
      percent,
      passed,
      evaluationType,
      requiresManualReview,
      questions,
      sections: [...sectionScores.values()],
    };
  }

  /**
   * Score a single auto-gradable question against AnswerSnapshots.
   * Exposed for unit tests without DB.
   */
  scoreAutoQuestion(
    qSnap: Pick<AssessmentQuestionSnapshotEntity, 'type'> | ScorableQuestionSnapshot,
    answerSnaps: Array<Pick<AssessmentAnswerSnapshotEntity, 'id' | 'isCorrect'>>,
    selectedIds: string[],
    points: number,
  ): { earned: number; isCorrect: boolean } {
    if (
      qSnap.type === QuestionType.SingleChoice ||
      qSnap.type === QuestionType.Reading ||
      (qSnap.type === QuestionType.Listening &&
        answerSnaps.filter((a) => a.isCorrect).length <= 1)
    ) {
      if (selectedIds.length === 1) {
        const snap = answerSnaps.find((a) => a.id === selectedIds[0]);
        if (snap?.isCorrect) {
          return { earned: points, isCorrect: true };
        }
      }
      return { earned: 0, isCorrect: false };
    }

    if (
      qSnap.type === QuestionType.MultipleChoice ||
      qSnap.type === QuestionType.Listening
    ) {
      const correctIds = new Set(
        answerSnaps.filter((a) => a.isCorrect).map((a) => a.id),
      );
      const selectedSet = new Set(selectedIds);
      const allCorrectSelected =
        correctIds.size > 0 &&
        [...correctIds].every((id) => selectedSet.has(id)) &&
        [...selectedSet].every((id) => correctIds.has(id));
      return {
        earned: allCorrectSelected ? points : 0,
        isCorrect: allCorrectSelected,
      };
    }

    return { earned: 0, isCorrect: false };
  }

  resolveEvaluationType(autoCount: number, manualCount: number): EvaluationType {
    if (manualCount > 0 && autoCount > 0) {
      return EvaluationType.Mixed;
    }
    if (manualCount > 0) {
      return EvaluationType.Manual;
    }
    return EvaluationType.Automatic;
  }

  resolvePassed(
    score: number,
    percent: number,
    rule?: PassingRuleInput | null,
  ): boolean {
    if (!rule) {
      return percent >= 60;
    }
    if (
      (rule.passingMode === PassingMode.Score || rule.passingMode === 'score') &&
      rule.passScore != null
    ) {
      return score >= Number(rule.passScore);
    }
    if (rule.passScorePercent != null) {
      return percent >= Number(rule.passScorePercent);
    }
    return percent >= 60;
  }
}
