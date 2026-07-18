import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ResultService } from '../services/result.service';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { AssessmentScoringService } from '../services/assessment-scoring.service';
import {
  EvaluationType,
  PassingMode,
  QuestionType,
  ResultStatus,
} from '../enums';
import {
  ASSESSMENT_RESULT_PASSED,
  ASSESSMENT_RESULT_REVIEWED,
} from '../events/assessment-result.events';
import {
  AssessmentAttemptRepository,
  AssessmentExamRepository,
  AssessmentResultRepository,
} from '../repositories';

describe('ResultService manual review', () => {
  const results = {
    findByAttemptId: jest.fn(),
    findById: jest.fn(),
    saveWithBreakdowns: jest.fn(),
    update: jest.fn(),
    updateWithBreakdowns: jest.fn(),
  } as unknown as jest.Mocked<AssessmentResultRepository>;

  const attempts = {
    findById: jest.fn(),
    findQuestionSnapshotsByAttemptId: jest.fn(),
    findAttemptAnswersByAttemptId: jest.fn(),
    findSelectedAnswerSnapshotIds: jest.fn(),
    findAnswerSnapshotsByQuestionSnapshotId: jest.fn(),
    saveAttemptAnswer: jest.fn(),
    updateAttemptAnswer: jest.fn(),
  } as unknown as jest.Mocked<AssessmentAttemptRepository>;

  const exams = {
    findWithStructure: jest.fn(),
    findRuleByExamId: jest.fn(),
  } as unknown as jest.Mocked<AssessmentExamRepository>;

  const scoring = new AssessmentScoringService(attempts);
  const access = {
    isAdmin: jest.fn(),
    isTeacher: jest.fn(),
    assertCanReadResult: jest.fn(),
    assertCanViewResults: jest.fn(),
    filterReadableResults: jest.fn(async (_a, rows) => rows),
  };
  const events = { emit: jest.fn() } as unknown as EventEmitter2;

  const service = new ResultService(
    results,
    attempts,
    exams,
    scoring,
    new AssessmentContentGuard(),
    access as never,
    events,
  );

  const teacherActor = { sub: 'teacher-user-1', role: 'teacher' };
  const otherTeacher = { sub: 'teacher-user-2', role: 'teacher' };

  beforeEach(() => {
    jest.clearAllMocks();
    access.isAdmin.mockReturnValue(false);
    access.isTeacher.mockReturnValue(true);
  });

  it('teacher can save review for own student result', async () => {
    const pending = {
      id: 'res-1',
      attemptId: 'att-1',
      examId: 'exam-1',
      status: ResultStatus.PendingReview,
      evaluationType: EvaluationType.Manual,
      passed: false,
    };
    access.assertCanReadResult.mockResolvedValue(pending);
    attempts.findQuestionSnapshotsByAttemptId.mockResolvedValue([
      {
        id: 'qs-1',
        sectionKey: 'main',
        type: QuestionType.ShortText,
        points: '10',
        stem: 'Translate',
      },
    ] as never);
    attempts.findAttemptAnswersByAttemptId
      .mockResolvedValueOnce([
        {
          id: 'aa-1',
          questionSnapshotId: 'qs-1',
          textAnswer: '你好',
          score: null,
          reviewComment: null,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 'aa-1',
          questionSnapshotId: 'qs-1',
          textAnswer: '你好',
          score: '8',
          reviewComment: 'Хорошо',
        },
      ] as never);
    attempts.findSelectedAnswerSnapshotIds.mockResolvedValue([]);
    attempts.findAnswerSnapshotsByQuestionSnapshotId.mockResolvedValue([]);
    attempts.updateAttemptAnswer.mockResolvedValue(undefined);

    const bundle = await service.saveReview('res-1', teacherActor as never, [
      { questionSnapshotId: 'qs-1', score: 8, comment: 'Хорошо' },
    ]);

    expect(attempts.updateAttemptAnswer).toHaveBeenCalledWith(
      'aa-1',
      expect.objectContaining({
        score: '8',
        reviewComment: 'Хорошо',
        reviewedByUserId: 'teacher-user-1',
      }),
    );
    expect(bundle.reviewStatus).toBe('in_progress');
  });

  it('teacher cannot review foreign student result', async () => {
    access.assertCanReadResult.mockRejectedValue(
      new ForbiddenException('Forbidden: cannot access another teacher Result'),
    );

    await expect(
      service.saveReview('res-foreign', otherTeacher as never, [
        { questionSnapshotId: 'qs-1', score: 5 },
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('finalize moves pending_review to passed and emits events', async () => {
    const pending = {
      id: 'res-1',
      attemptId: 'att-1',
      examId: 'exam-1',
      status: ResultStatus.PendingReview,
      evaluationType: EvaluationType.Manual,
      passed: false,
    };
    access.assertCanReadResult.mockResolvedValue(pending);
    attempts.findById.mockResolvedValue({
      id: 'att-1',
      examId: 'exam-1',
      studentId: 'stu-1',
    } as never);
    exams.findWithStructure.mockResolvedValue({
      id: 'exam-1',
      sections: [{ sectionKey: 'main', weight: '1' }],
      rule: {
        passingMode: PassingMode.Percent,
        passScorePercent: '50',
        passScore: null,
      },
    } as never);
    attempts.findQuestionSnapshotsByAttemptId.mockResolvedValue([
      {
        id: 'qs-1',
        sectionKey: 'main',
        type: QuestionType.ShortText,
        points: '10',
        stem: 'Translate',
      },
    ] as never);
    attempts.findAttemptAnswersByAttemptId.mockResolvedValue([
      {
        id: 'aa-1',
        questionSnapshotId: 'qs-1',
        textAnswer: '你好',
        score: '10',
        reviewComment: 'Отлично',
      },
    ] as never);

    const finalized = {
      id: 'res-1',
      attemptId: 'att-1',
      examId: 'exam-1',
      status: ResultStatus.Passed,
      passed: true,
      score: '10',
      maxScore: '10',
      percent: '100.00',
    };
    results.updateWithBreakdowns.mockResolvedValue(finalized as never);

    const result = await service.finalizeReview('res-1', teacherActor as never);

    expect(results.updateWithBreakdowns).toHaveBeenCalledWith(
      'res-1',
      expect.objectContaining({
        status: ResultStatus.Passed,
        passed: true,
        score: '10',
        maxScore: '10',
      }),
      expect.any(Array),
    );
    expect(events.emit).toHaveBeenCalledWith(ASSESSMENT_RESULT_PASSED, finalized);
    expect(events.emit).toHaveBeenCalledWith(ASSESSMENT_RESULT_REVIEWED, finalized);
    expect(result.status).toBe(ResultStatus.Passed);
  });

  it('finalize fails when manual scores are missing', async () => {
    const pending = {
      id: 'res-1',
      attemptId: 'att-1',
      examId: 'exam-1',
      status: ResultStatus.PendingReview,
    };
    access.assertCanReadResult.mockResolvedValue(pending);
    attempts.findById.mockResolvedValue({ id: 'att-1', examId: 'exam-1' } as never);
    exams.findWithStructure.mockResolvedValue({
      id: 'exam-1',
      sections: [{ sectionKey: 'main', weight: '1' }],
      rule: { passScorePercent: '50' },
    } as never);
    attempts.findQuestionSnapshotsByAttemptId.mockResolvedValue([
      {
        id: 'qs-1',
        sectionKey: 'main',
        type: QuestionType.ShortText,
        points: '10',
      },
    ] as never);
    attempts.findAttemptAnswersByAttemptId.mockResolvedValue([
      { id: 'aa-1', questionSnapshotId: 'qs-1', score: null },
    ] as never);

    await expect(
      service.finalizeReview('res-1', teacherActor as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cannot finalize already passed result', async () => {
    access.assertCanReadResult.mockResolvedValue({
      id: 'res-1',
      status: ResultStatus.Passed,
    } as never);

    await expect(
      service.finalizeReview('res-1', teacherActor as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ResultService processing', () => {
  const results = {
    findByAttemptId: jest.fn(),
    saveWithBreakdowns: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<AssessmentResultRepository>;

  const attempts = {
    findById: jest.fn(),
    findQuestionSnapshotsByAttemptId: jest.fn(),
    findAttemptAnswersByAttemptId: jest.fn(),
    findSelectedAnswerSnapshotIds: jest.fn(),
    findAnswerSnapshotsByQuestionSnapshotId: jest.fn(),
    saveAttemptAnswer: jest.fn(),
    updateAttemptAnswer: jest.fn(),
  } as unknown as jest.Mocked<AssessmentAttemptRepository>;

  const exams = {
    findWithStructure: jest.fn(),
    findRuleByExamId: jest.fn(),
  } as unknown as jest.Mocked<AssessmentExamRepository>;

  const scoring = new AssessmentScoringService(attempts);
  const access = {
    assertCanReadResult: jest.fn(),
    assertCanViewResults: jest.fn(),
    filterReadableResults: jest.fn(async (_a, rows) => rows),
    isAdmin: jest.fn(),
    isTeacher: jest.fn(),
  };
  const service = new ResultService(
    results,
    attempts,
    exams,
    scoring,
    new AssessmentContentGuard(),
    access as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('short_text creates pending_review', async () => {
    results.findByAttemptId.mockResolvedValue(null);
    exams.findWithStructure.mockResolvedValue({
      id: 'exam-1',
      sections: [{ sectionKey: 'main', weight: '1' }],
      rule: {
        passingMode: PassingMode.Percent,
        passScorePercent: '50',
        passScore: null,
      },
    } as never);

    attempts.findQuestionSnapshotsByAttemptId.mockResolvedValue([
      {
        id: 'qs-1',
        sectionKey: 'main',
        type: QuestionType.ShortText,
        points: '5',
      },
    ] as never);
    attempts.findAttemptAnswersByAttemptId.mockResolvedValue([
      { id: 'aa-1', questionSnapshotId: 'qs-1', textAnswer: 'answer' },
    ] as never);
    attempts.findSelectedAnswerSnapshotIds.mockResolvedValue([]);

    results.saveWithBreakdowns.mockResolvedValue({
      id: 'res-1',
      status: ResultStatus.Processing,
      evaluationType: EvaluationType.Manual,
    } as never);
    results.update.mockResolvedValue({
      id: 'res-1',
      status: ResultStatus.PendingReview,
      evaluationType: EvaluationType.Manual,
      passed: false,
    } as never);

    const result = await service.createForSubmittedAttempt({
      id: 'att-1',
      examId: 'exam-1',
      attemptNumber: 1,
      startedAt: new Date('2026-01-01T10:00:00Z'),
      submittedAt: new Date('2026-01-01T10:30:00Z'),
    } as never);

    expect(result.status).toBe(ResultStatus.PendingReview);
  });

  it('submitted attempt cannot be rescored automatically', async () => {
    results.findByAttemptId.mockResolvedValue({
      id: 'res-1',
      status: ResultStatus.Passed,
      evaluationType: EvaluationType.Automatic,
    } as never);

    await expect(
      service.createForSubmittedAttempt({
        id: 'att-1',
        examId: 'exam-1',
        attemptNumber: 1,
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
