import { ForbiddenException } from '@nestjs/common';
import { AttemptStatus, SubmitReason } from '../../assessment/enums';
import { SESSION_STATUS } from '../constants';
import { ExamAcademySessionService } from '../services/exam-academy-session.service';

describe('ExamAcademySessionService abandon / preparation', () => {
  const sessions = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const sessionAttempts = {
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
  };
  const attemptRepo = {
    findById: jest.fn(),
    countEngagedAnswers: jest.fn(),
    filter: jest.fn(),
  };
  const results = {
    findByAttemptId: jest.fn(),
  };
  const access = {
    isAdmin: jest.fn().mockReturnValue(false),
  };

  const service = new ExamAcademySessionService(
    sessions as never,
    sessionAttempts as never,
    {} as never, // contentItems
    {} as never, // levels
    {} as never, // versions
    {} as never, // blueprints
    {} as never, // favorites
    {} as never, // reviewItems
    {} as never, // statsDaily
    {} as never, // parts
    {} as never, // poolItems
    {} as never, // teachers
    {} as never, // exams
    {} as never, // attempts AttemptService
    attemptRepo as never,
    results as never,
    access as never,
    {} as never, // variantGenerator
    {} as never, // ecpBlueprints
  );

  const actor = { sub: 'user-1', role: 'student', email: 'a@b.c' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('abandonIfEmpty cancels session without engagement', async () => {
    sessions.findOne.mockResolvedValue({
      id: 's1',
      createdByUserId: 'user-1',
      status: SESSION_STATUS.InProgress,
      completedAt: null,
    });
    sessionAttempts.findOne.mockResolvedValue({
      sessionId: 's1',
      assessmentAttemptId: 'a1',
    });
    attemptRepo.countEngagedAnswers.mockResolvedValue(0);
    sessions.update.mockResolvedValue(undefined);

    const out = await service.abandonIfEmpty(actor as never, 's1');
    expect(out.discarded).toBe(true);
    expect(sessions.update).toHaveBeenCalledWith('s1', {
      status: SESSION_STATUS.Cancelled,
      completedAt: null,
    });
  });

  it('abandonIfEmpty keeps engaged session', async () => {
    sessions.findOne.mockResolvedValue({
      id: 's1',
      createdByUserId: 'user-1',
      status: SESSION_STATUS.InProgress,
      completedAt: null,
    });
    sessionAttempts.findOne.mockResolvedValue({
      sessionId: 's1',
      assessmentAttemptId: 'a1',
    });
    attemptRepo.countEngagedAnswers.mockResolvedValue(2);

    const out = await service.abandonIfEmpty(actor as never, 's1');
    expect(out.discarded).toBe(false);
    expect(sessions.update).not.toHaveBeenCalled();
  });

  it('listPreparationHistory excludes empty and cancelled', async () => {
    sessions.find.mockResolvedValue([
      {
        id: 'empty',
        createdByUserId: 'user-1',
        status: SESSION_STATUS.InProgress,
        mode: 'practice',
        createdAt: new Date(),
        startedAt: new Date(),
      },
      {
        id: 'engaged',
        createdByUserId: 'user-1',
        status: SESSION_STATUS.InProgress,
        mode: 'practice',
        createdAt: new Date(),
        startedAt: new Date(),
      },
      {
        id: 'done',
        createdByUserId: 'user-1',
        status: SESSION_STATUS.Completed,
        mode: 'mock_exam',
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ]);

    sessionAttempts.findOne.mockImplementation(async ({ where }) => ({
      sessionId: where.sessionId,
      assessmentAttemptId: `att-${where.sessionId}`,
    }));
    attemptRepo.findById.mockImplementation(async (id: string) => ({
      id,
      status: id.includes('done') ? AttemptStatus.Submitted : AttemptStatus.Started,
      submitReason: id.includes('done') ? SubmitReason.Manual : null,
      expiresAt: null,
      submittedAt: id.includes('done') ? new Date() : null,
    }));
    attemptRepo.countEngagedAnswers.mockImplementation(async (id: string) =>
      id.includes('empty') ? 0 : 1,
    );
    results.findByAttemptId.mockResolvedValue({
      percent: '80',
      score: '8',
      maxScore: '10',
    });
    sessions.update.mockResolvedValue(undefined);

    const history = await service.listPreparationHistory('user-1', 30);
    const ids = history.map((h) => h.id);
    expect(ids).toEqual(['engaged', 'done']);
    expect(history.find((h) => h.id === 'done')?.display_status).toBe(SESSION_STATUS.Completed);
    expect(sessions.update).toHaveBeenCalledWith(
      'empty',
      expect.objectContaining({ status: SESSION_STATUS.Cancelled }),
    );
  });

  it('syncSessionLifecycle marks timeout submit without answers as cancelled', async () => {
    const session = {
      id: 's1',
      status: SESSION_STATUS.InProgress,
      completedAt: null,
    };
    sessionAttempts.findOne.mockResolvedValue({
      sessionId: 's1',
      assessmentAttemptId: 'a1',
    });
    attemptRepo.findById.mockResolvedValue({
      id: 'a1',
      status: AttemptStatus.Submitted,
      submitReason: SubmitReason.Timeout,
      submittedAt: new Date(),
      expiresAt: new Date(),
    });
    attemptRepo.countEngagedAnswers.mockResolvedValue(0);

    const out = await service.syncSessionLifecycle(session as never);
    expect(out.status).toBe(SESSION_STATUS.Cancelled);
  });

  it('get rejects foreign session', async () => {
    sessions.findOne.mockResolvedValue({
      id: 's1',
      createdByUserId: 'other',
      status: SESSION_STATUS.InProgress,
    });
    await expect(service.get(actor as never, 's1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
