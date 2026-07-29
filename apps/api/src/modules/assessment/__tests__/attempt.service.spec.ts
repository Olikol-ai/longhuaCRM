import { ConflictException } from '@nestjs/common';
import { AttemptService } from '../services/attempt.service';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { AssessmentParticipantResolver } from '../services/assessment-participant-resolver.service';
import { ResultService } from '../services/result.service';
import {
  AttemptStatus,
  ContentLifecycleStatus,
  QuestionType,
  SubmitReason,
} from '../enums';
import {
  AssessmentAssignmentRepository,
  AssessmentAttemptRepository,
  AssessmentExamRepository,
  AssessmentQuestionRepository,
} from '../repositories';

describe('AttemptService', () => {
  const attempts = {
    findById: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    countAttemptsForUserExamByStatus: jest.fn(),
    countAttemptsForUserExam: jest.fn(),
    countSnapshots: jest.fn(),
    saveSnapshotsInBulk: jest.fn(),
    findAttemptAnswersByAttemptId: jest.fn(),
    saveAttemptAnswer: jest.fn(),
    replaceSelectionsForAttemptAnswer: jest.fn(),
  } as unknown as jest.Mocked<AssessmentAttemptRepository>;

  const exams = {
    findWithStructure: jest.fn(),
    findRuleByExamId: jest.fn(),
  } as unknown as jest.Mocked<AssessmentExamRepository>;

  const assignments = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<AssessmentAssignmentRepository>;

  const questions = {
    findByIdsWithAnswers: jest.fn(),
  } as unknown as jest.Mocked<AssessmentQuestionRepository>;

  const results = {
    createForSubmittedAttempt: jest.fn(),
  } as unknown as jest.Mocked<ResultService>;

  const participants = {
    resolveParticipantIds: jest.fn(),
  } as unknown as jest.Mocked<AssessmentParticipantResolver>;

  const access = {
    assertCanStartAttempt: jest.fn().mockResolvedValue(undefined),
    assertCanAccessAttempt: jest.fn().mockResolvedValue({ id: 'att-1' }),
    assertCanMutateAttempt: jest.fn().mockResolvedValue({ id: 'att-1' }),
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attempt cannot submit twice', async () => {
    attempts.findById.mockResolvedValue({
      id: 'att-1',
      status: AttemptStatus.Submitted,
    } as never);

    await expect(
      service.submit({ attemptId: 'att-1', submitReason: SubmitReason.Manual }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.submit({ attemptId: 'att-1', submitReason: SubmitReason.Manual }),
    ).rejects.toThrow(/already submitted/);
    expect(results.createForSubmittedAttempt).not.toHaveBeenCalled();
  });

  it('start creates snapshot once', async () => {
    const examId = 'exam-1';
    const userId = 'user-1';
    const questionId = 'q-1';
    const sectionId = 'sec-1';

    exams.findWithStructure.mockResolvedValue({
      id: examId,
      status: ContentLifecycleStatus.Published,
      sections: [{ id: sectionId, sectionKey: 'reading', title: 'Reading', weight: '1' }],
      examQuestions: [{ questionId, sectionId, sortOrder: 0 }],
      rule: {
        durationMinutes: 60,
        maxAttempts: 3,
        randomizeQuestions: false,
        randomizeAnswers: false,
      },
    } as never);

    attempts.countAttemptsForUserExamByStatus.mockResolvedValue(0);
    attempts.countAttemptsForUserExam.mockResolvedValue(0);
    attempts.save.mockResolvedValue({
      id: 'att-new',
      examId,
      userId,
      status: AttemptStatus.Started,
    } as never);
    attempts.countSnapshots.mockResolvedValue(0);
    questions.findByIdsWithAnswers.mockResolvedValue([
      {
        id: questionId,
        type: QuestionType.SingleChoice,
        stem: 'Stem',
        points: '1',
        difficulty: 1,
        explanation: null,
        answers: [
          { id: 'a-1', text: 'A', isCorrect: true, sortOrder: 0 },
          { id: 'a-2', text: 'B', isCorrect: false, sortOrder: 1 },
        ],
      },
    ] as never);
    attempts.saveSnapshotsInBulk
      .mockResolvedValueOnce({
        questionSnapshots: [
          {
            id: 'qs-1',
            sourceQuestionId: questionId,
            attemptId: 'att-new',
            sortOrder: 0,
          },
        ],
        answerSnapshots: [],
      } as never)
      .mockResolvedValueOnce({
        questionSnapshots: [],
        answerSnapshots: [],
      } as never);
    attempts.findById.mockResolvedValue({
      id: 'att-new',
      examId,
      status: AttemptStatus.Started,
    } as never);

    await service.start({
      examId,
      userId,
      studentId: 'student-1',
      teacherId: null,
    });

    expect(attempts.saveSnapshotsInBulk).toHaveBeenCalledTimes(2);
    expect(attempts.countSnapshots).toHaveBeenCalledWith('att-new');

    attempts.countSnapshots.mockResolvedValue(1);
    attempts.save.mockResolvedValue({
      id: 'att-dup',
      examId,
      userId,
      status: AttemptStatus.Started,
    } as never);

    await expect(
      service.start({
        examId,
        userId,
        studentId: 'student-1',
        teacherId: null,
      }),
    ).rejects.toThrow(/Snapshot already exists/);
  });
});
