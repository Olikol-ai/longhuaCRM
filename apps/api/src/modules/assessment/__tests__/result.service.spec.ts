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
  ScoreSource,
  ShowCorrectAnswers,
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
    updateFinalScoreIfExpected: jest.fn(),
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
    assertCanAdjustFinalScore: jest.fn(),
    canAdjustFinalScore: jest.fn(),
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
    access.canAdjustFinalScore.mockResolvedValue(false);
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
      scoreSource: ScoreSource.Auto,
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
      autoScore: '10',
      scoreSource: ScoreSource.Auto,
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
        autoScore: '10',
        scoreSource: ScoreSource.Auto,
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

describe('ResultService student feedback', () => {
  const results = {
    findByAttemptId: jest.fn(),
    findById: jest.fn(),
  } as unknown as jest.Mocked<AssessmentResultRepository>;

  const attempts = {
    findQuestionSnapshotsByAttemptId: jest.fn(),
    findAttemptAnswersByAttemptId: jest.fn(),
    findSelectedAnswerSnapshotIds: jest.fn(),
    findAnswerSnapshotsByQuestionSnapshotId: jest.fn(),
  } as unknown as jest.Mocked<AssessmentAttemptRepository>;

  const exams = {
    findRuleByExamId: jest.fn(),
  } as unknown as jest.Mocked<AssessmentExamRepository>;

  const scoring = new AssessmentScoringService(attempts);
  const access = {
    isAdmin: jest.fn().mockReturnValue(false),
    isTeacher: jest.fn().mockReturnValue(false),
    isStudent: jest.fn().mockReturnValue(true),
    assertCanReadResult: jest.fn(),
  };

  const service = new ResultService(
    results,
    attempts,
    exams,
    scoring,
    new AssessmentContentGuard(),
    access as never,
  );

  it('returns review_comment for the owning student without examiner fields', async () => {
    const student = { sub: 'student-user-1', role: 'student' };
    const resultRow = {
      id: 'res-1',
      attemptId: 'att-1',
      examId: 'exam-1',
      status: ResultStatus.Passed,
      passed: true,
      score: '1',
      autoScore: '0.5',
      scoreSource: ScoreSource.Manual,
      maxScore: '2',
      percent: '50.00',
      evaluationType: EvaluationType.Automatic,
      startedAt: new Date(),
      finishedAt: new Date(),
      duration: 60,
      attemptNumber: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      breakdowns: [],
    };
    access.assertCanReadResult.mockResolvedValue(resultRow as never);
    results.findByAttemptId.mockResolvedValue(resultRow as never);
    exams.findRuleByExamId.mockResolvedValue({
      showCorrectAnswers: ShowCorrectAnswers.Never,
    } as never);
    attempts.findQuestionSnapshotsByAttemptId.mockResolvedValue([
      {
        id: 'qs-1',
        sectionKey: 'main',
        type: QuestionType.ShortText,
        points: '2',
        stem: 'Translate',
        explanation: 'SECRET_ETALON',
      },
    ] as never);
    attempts.findAttemptAnswersByAttemptId.mockResolvedValue([
      {
        id: 'aa-1',
        questionSnapshotId: 'qs-1',
        textAnswer: 'wrong',
        score: '0.5',
        isCorrect: false,
        reviewComment: 'Нужен другой порядок',
        reviewedByUserId: 'teacher-1',
      },
    ] as never);
    attempts.findSelectedAnswerSnapshotIds.mockResolvedValue([]);
    attempts.findAnswerSnapshotsByQuestionSnapshotId.mockResolvedValue([]);

    const bundle = await service.getStudentFeedback('res-1', student as never);
    expect(bundle.items).toHaveLength(1);
    expect(bundle.items[0].review_comment).toBe('Нужен другой порядок');
    expect(bundle.items[0].score).toBe(0.5);
    expect(bundle.items[0].expected_answer).toBeNull();
    expect(bundle.show_correct_answers).toBe(false);
    expect(bundle.result.score).toBe('1');
    expect(bundle.result.auto_score).toBeNull();
    expect(JSON.stringify(bundle)).not.toContain('reviewedByUserId');
    expect(JSON.stringify(bundle)).not.toContain('teacher-1');
    expect(JSON.stringify(bundle)).not.toContain('"0.5"');
  });
});

describe('ResultService final score adjust', () => {
  const results = {
    findByAttemptId: jest.fn(),
    findById: jest.fn(),
    updateFinalScoreIfExpected: jest.fn(),
    updateWithBreakdowns: jest.fn(),
  } as unknown as jest.Mocked<AssessmentResultRepository>;

  const attempts = {
    findById: jest.fn(),
    findAttemptAnswersByAttemptId: jest.fn(),
    findQuestionSnapshotsByAttemptId: jest.fn(),
    findSelectedAnswerSnapshotIds: jest.fn(),
    findAnswerSnapshotsByQuestionSnapshotId: jest.fn(),
    updateAttemptAnswer: jest.fn(),
  } as unknown as jest.Mocked<AssessmentAttemptRepository>;

  const exams = {
    findRuleByExamId: jest.fn(),
    findWithStructure: jest.fn(),
  } as unknown as jest.Mocked<AssessmentExamRepository>;

  const scoring = new AssessmentScoringService(attempts);
  const access = {
    isAdmin: jest.fn(),
    isTeacher: jest.fn(),
    assertCanReadResult: jest.fn(),
    assertCanAdjustFinalScore: jest.fn(),
    canAdjustFinalScore: jest.fn(),
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

  const assigner = { sub: 'teacher-assigner', role: 'teacher' };
  const otherTeacher = { sub: 'teacher-other', role: 'teacher' };

  const baseResult = {
    id: 'res-1',
    attemptId: 'att-1',
    examId: 'exam-1',
    status: ResultStatus.Passed,
    passed: true,
    score: '7',
    autoScore: '7',
    scoreSource: ScoreSource.Auto,
    maxScore: '10',
    percent: '70.00',
    evaluationType: EvaluationType.Automatic,
    attemptNumber: 1,
    startedAt: new Date(),
    finishedAt: new Date(),
    duration: 120,
    createdAt: new Date(),
    updatedAt: new Date(),
    breakdowns: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    access.isAdmin.mockReturnValue(false);
    access.isTeacher.mockReturnValue(true);
    exams.findRuleByExamId.mockResolvedValue({
      passingMode: PassingMode.Percent,
      passScorePercent: '60',
      passScore: null,
    } as never);
  });

  it('assigner can adjust final score without changing auto_score or answers', async () => {
    access.assertCanAdjustFinalScore.mockResolvedValue(baseResult as never);
    const updated = {
      ...baseResult,
      score: '9',
      scoreSource: ScoreSource.Manual,
      percent: '90.00',
      passed: true,
      status: ResultStatus.Passed,
    };
    results.updateFinalScoreIfExpected.mockResolvedValue(updated as never);

    const dto = await service.adjustFinalScore('res-1', assigner as never, {
      score: 9,
      expectedScore: 7,
      reason: 'Устная часть',
    });

    expect(results.updateFinalScoreIfExpected).toHaveBeenCalledWith(
      'res-1',
      '7',
      expect.objectContaining({
        score: '9',
        scoreSource: ScoreSource.Manual,
        percent: '90.00',
        passed: true,
        status: ResultStatus.Passed,
      }),
      expect.objectContaining({
        actorUserId: 'teacher-assigner',
        summary: 'Final score 7 → 9',
        oldVersion: expect.stringContaining('"score":"7"'),
        newVersion: expect.stringContaining('"reason":"Устная часть"'),
      }),
    );
    expect(dto.score).toBe('9');
    expect(dto.auto_score).toBe('7');
    expect(dto.score_source).toBe(ScoreSource.Manual);
    expect(attempts.updateAttemptAnswer).not.toHaveBeenCalled();
  });

  it('recalculates passed/failed from threshold after manual final score', async () => {
    access.assertCanAdjustFinalScore.mockResolvedValue(baseResult as never);
    results.updateFinalScoreIfExpected.mockResolvedValue({
      ...baseResult,
      score: '5',
      scoreSource: ScoreSource.Manual,
      percent: '50.00',
      passed: false,
      status: ResultStatus.Failed,
    } as never);

    const dto = await service.adjustFinalScore('res-1', assigner as never, {
      score: 5,
      expectedScore: 7,
    });

    expect(results.updateFinalScoreIfExpected).toHaveBeenCalledWith(
      'res-1',
      '7',
      expect.objectContaining({
        score: '5',
        passed: false,
        status: ResultStatus.Failed,
        percent: '50.00',
      }),
      expect.objectContaining({
        actorUserId: 'teacher-assigner',
      }),
    );
    expect(dto.passed).toBe(false);
    expect(dto.status).toBe(ResultStatus.Failed);
  });

  it('passes audit payload in the same update call (atomic with score write)', async () => {
    access.assertCanAdjustFinalScore.mockResolvedValue(baseResult as never);
    results.updateFinalScoreIfExpected.mockResolvedValue({
      ...baseResult,
      score: '9',
      scoreSource: ScoreSource.Manual,
    } as never);

    await service.adjustFinalScore('res-1', assigner as never, {
      score: 9,
      expectedScore: 7,
    });

    expect(results.updateFinalScoreIfExpected.mock.calls[0]).toHaveLength(4);
    const audit = results.updateFinalScoreIfExpected.mock.calls[0][3] as {
      oldVersion: string;
      newVersion: string;
    };
    expect(JSON.parse(audit.oldVersion).auto_score).toBe('7');
    expect(JSON.parse(audit.newVersion).auto_score).toBe('7');
    expect(JSON.parse(audit.newVersion).score).toBe('9');
  });

  it('other teacher cannot adjust final score', async () => {
    access.assertCanAdjustFinalScore.mockRejectedValue(
      new ForbiddenException(
        'Forbidden: only the teacher who assigned this exam can adjust final score',
      ),
    );

    await expect(
      service.adjustFinalScore('res-1', otherTeacher as never, {
        score: 9,
        expectedScore: 7,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(results.updateFinalScoreIfExpected).not.toHaveBeenCalled();
  });

  it('rejects adjust while pending_review', async () => {
    access.assertCanAdjustFinalScore.mockResolvedValue({
      ...baseResult,
      status: ResultStatus.PendingReview,
      passed: false,
    } as never);

    await expect(
      service.adjustFinalScore('res-1', assigner as never, {
        score: 9,
        expectedScore: 7,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects out-of-range final score', async () => {
    access.assertCanAdjustFinalScore.mockResolvedValue(baseResult as never);

    await expect(
      service.adjustFinalScore('res-1', assigner as never, {
        score: 11,
        expectedScore: 7,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects concurrent change when expected score mismatches', async () => {
    access.assertCanAdjustFinalScore.mockResolvedValue({
      ...baseResult,
      score: '8',
    } as never);

    await expect(
      service.adjustFinalScore('res-1', assigner as never, {
        score: 9,
        expectedScore: 7,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(results.updateFinalScoreIfExpected).not.toHaveBeenCalled();
  });

  it('rejects when optimistic update loses the race', async () => {
    access.assertCanAdjustFinalScore.mockResolvedValue(baseResult as never);
    results.updateFinalScoreIfExpected.mockResolvedValue(null);

    await expect(
      service.adjustFinalScore('res-1', assigner as never, {
        score: 9,
        expectedScore: 7,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('finalize after manual preserves final score, stores auto_score, leaves pending_review', async () => {
    // Defensive path: pending_review with accidental manual source.
    const pending = {
      id: 'res-1',
      attemptId: 'att-1',
      examId: 'exam-1',
      status: ResultStatus.PendingReview,
      score: '9',
      autoScore: '7',
      scoreSource: ScoreSource.Manual,
      maxScore: '10',
      evaluationType: EvaluationType.Mixed,
      passed: false,
    };
    access.assertCanReadResult.mockResolvedValue(pending as never);
    access.isTeacher.mockReturnValue(true);
    attempts.findById.mockResolvedValue({ id: 'att-1', examId: 'exam-1' } as never);
    exams.findWithStructure.mockResolvedValue({
      id: 'exam-1',
      sections: [{ sectionKey: 'main', weight: '1' }],
      rule: {
        passingMode: PassingMode.Percent,
        passScorePercent: '60',
      },
    } as never);
    attempts.findQuestionSnapshotsByAttemptId.mockResolvedValue([
      {
        id: 'qs-1',
        sectionKey: 'main',
        type: QuestionType.SingleChoice,
        points: '10',
      },
    ] as never);
    attempts.findAttemptAnswersByAttemptId.mockResolvedValue([
      { id: 'aa-1', questionSnapshotId: 'qs-1', score: '7' },
    ] as never);
    results.updateWithBreakdowns.mockResolvedValue({
      ...pending,
      autoScore: '7',
      score: '9',
      scoreSource: ScoreSource.Manual,
      status: ResultStatus.Passed,
      passed: true,
      percent: '90.00',
    } as never);

    await service.finalizeReview('res-1', assigner as never);

    expect(results.updateWithBreakdowns).toHaveBeenCalledWith(
      'res-1',
      expect.objectContaining({
        autoScore: '7',
        status: ResultStatus.Passed,
        passed: true,
        percent: '90.00',
      }),
      expect.any(Array),
    );
    const patch = results.updateWithBreakdowns.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(patch.score).toBeUndefined();
    expect(patch.scoreSource).toBeUndefined();
  });
});
