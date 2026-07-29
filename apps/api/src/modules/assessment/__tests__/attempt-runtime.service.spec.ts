import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AttemptService } from '../services/attempt.service';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { AssessmentParticipantResolver } from '../services/assessment-participant-resolver.service';
import { ResultService } from '../services/result.service';
import { AttemptStatus, QuestionType } from '../enums';
import {
  AssessmentAssignmentRepository,
  AssessmentAttemptRepository,
  AssessmentExamRepository,
  AssessmentQuestionRepository,
} from '../repositories';

describe('AttemptService runtime flow', () => {
  const attempts = {
    findById: jest.fn(),
    findQuestionSnapshotsByAttemptId: jest.fn(),
    findAnswerSnapshotsByQuestionSnapshotId: jest.fn(),
    findAnswerSnapshotsByAttemptId: jest.fn(),
    findAttemptAnswersByAttemptId: jest.fn(),
    saveAttemptAnswer: jest.fn(),
    replaceSelectionsForAttemptAnswer: jest.fn(),
  } as unknown as jest.Mocked<AssessmentAttemptRepository>;

  const exams = {} as unknown as jest.Mocked<AssessmentExamRepository>;
  const assignments = {} as unknown as jest.Mocked<AssessmentAssignmentRepository>;
  const questions = {} as unknown as jest.Mocked<AssessmentQuestionRepository>;
  const results = {} as unknown as jest.Mocked<ResultService>;
  const participants = {} as unknown as jest.Mocked<AssessmentParticipantResolver>;

  const access = {
    assertCanStartAttempt: jest.fn().mockResolvedValue(undefined),
    assertCanAccessAttempt: jest.fn().mockImplementation(async (_a, id) => ({
      id,
      userId: owner.sub,
      status: AttemptStatus.Started,
    })),
    assertCanMutateAttempt: jest.fn().mockImplementation(async (actor, id) => {
      const attempt = await attempts.findById(id);
      if (attempt && attempt.userId !== actor.sub && actor.role !== 'admin') {
        throw new ForbiddenException('Forbidden: cannot modify foreign Attempt');
      }
      return attempt;
    }),
    filterReadableAttempts: jest.fn(async (_a, rows) => rows),
  };

  const service = new AttemptService(
    attempts,
    exams,
    assignments,
    questions,
    results,
    new AssessmentContentGuard(),
    participants,
    access as never,
    { findOne: jest.fn() } as never,
  );

  const owner = { sub: 'user-student', role: 'student', email: 's@test.com' };
  const attemptId = 'att-1';
  const qSnapId = 'qs-1';
  const answerSnapId = 'as-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockStartedAttempt(userId = owner.sub) {
    attempts.findById.mockResolvedValue({
      id: attemptId,
      userId,
      status: AttemptStatus.Started,
    } as never);
  }

  function mockSnapshots() {
    attempts.findQuestionSnapshotsByAttemptId.mockResolvedValue([
      {
        id: qSnapId,
        attemptId,
        type: QuestionType.SingleChoice,
        stem: 'Q1',
        points: '1',
        difficulty: 1,
        explanation: null,
        sortOrder: 0,
        sectionKey: 'main',
        sourceQuestionId: 'q-src-1',
      },
    ] as never);
    attempts.findAnswerSnapshotsByQuestionSnapshotId.mockResolvedValue([
      {
        id: answerSnapId,
        questionSnapshotId: qSnapId,
        text: 'A',
        isCorrect: true,
        sortOrder: 0,
        sourceAnswerId: 'ans-src-1',
      },
      {
        id: 'as-2',
        questionSnapshotId: qSnapId,
        text: 'B',
        isCorrect: false,
        sortOrder: 1,
        sourceAnswerId: 'ans-src-2',
      },
    ] as never);
    attempts.findAnswerSnapshotsByAttemptId.mockResolvedValue([
      {
        id: answerSnapId,
        questionSnapshotId: qSnapId,
        text: 'A',
        isCorrect: true,
        sortOrder: 0,
        sourceAnswerId: 'ans-src-1',
      },
    ] as never);
  }

  it('student can autosave answer', async () => {
    mockStartedAttempt();
    mockSnapshots();
    attempts.findAttemptAnswersByAttemptId.mockResolvedValue([]);
    attempts.saveAttemptAnswer.mockResolvedValue({
      id: 'aa-1',
      attemptId,
      questionSnapshotId: qSnapId,
      textAnswer: null,
    } as never);
    attempts.replaceSelectionsForAttemptAnswer.mockResolvedValue([]);

    const result = await service.autosaveAnswers({
      attemptId,
      userId: owner.sub,
      role: owner.role,
      answers: [
        {
          questionSnapshotId: qSnapId,
          selectedAnswerSnapshotIds: [answerSnapId],
          selectionsProvided: true,
          textProvided: false,
        },
      ],
    });

    expect(result.count).toBe(1);
    expect(result.savedAt).toBeInstanceOf(Date);
    expect(attempts.saveAttemptAnswer).toHaveBeenCalled();
    expect(attempts.replaceSelectionsForAttemptAnswer).toHaveBeenCalledWith('aa-1', [
      answerSnapId,
    ]);
  });

  it('cannot autosave submitted attempt', async () => {
    attempts.findById.mockResolvedValue({
      id: attemptId,
      userId: owner.sub,
      status: AttemptStatus.Submitted,
    } as never);

    await expect(
      service.autosaveAnswers({
        attemptId,
        userId: owner.sub,
        role: owner.role,
        answers: [{ questionSnapshotId: qSnapId, selectionsProvided: true }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cannot answer foreign snapshot question', async () => {
    mockStartedAttempt();
    mockSnapshots();

    await expect(
      service.autosaveAnswers({
        attemptId,
        userId: owner.sub,
        role: owner.role,
        answers: [
          {
            questionSnapshotId: 'foreign-qs',
            selectedAnswerSnapshotIds: [answerSnapId],
            selectionsProvided: true,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.autosaveAnswers({
        attemptId,
        userId: owner.sub,
        role: owner.role,
        answers: [
          {
            questionSnapshotId: qSnapId,
            selectedAnswerSnapshotIds: ['foreign-answer'],
            selectionsProvided: true,
          },
        ],
      }),
    ).rejects.toThrow(/does not belong to this question Snapshot/);
  });

  it('snapshot returns immutable data', async () => {
    mockStartedAttempt();
    mockSnapshots();

    const payload = await service.getSnapshots(attemptId, owner);

    expect(payload.questionSnapshots).toHaveLength(1);
    expect(payload.questionSnapshots[0]).toMatchObject({
      id: qSnapId,
      attemptId,
      stem: 'Q1',
      type: QuestionType.SingleChoice,
      sourceQuestionId: 'q-src-1',
    });
    expect(payload.answerSnapshots).toHaveLength(1);
    expect(payload.answerSnapshots[0]).toMatchObject({
      id: answerSnapId,
      questionSnapshotId: qSnapId,
      text: 'A',
    });
    expect(payload.answerSnapshots[0].isCorrect).toBeUndefined();
    expect(Object.keys(payload)).toEqual(['questionSnapshots', 'answerSnapshots']);
  });

  it('rejects autosave on foreign attempt', async () => {
    mockStartedAttempt('other-user');
    await expect(
      service.autosaveAnswers({
        attemptId,
        userId: owner.sub,
        role: owner.role,
        answers: [{ questionSnapshotId: qSnapId, selectionsProvided: true }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
