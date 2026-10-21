import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminAssessmentService } from '../services/admin-assessment.service';
import { ResultStatus, ScoreSource } from '../enums';

describe('AdminAssessmentService', () => {
  const access = {
    isAdmin: jest.fn(),
  };

  const results = {
    getReviewBundle: jest.fn(),
  };

  const examRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const attemptRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const resultRepo = {
    findOne: jest.fn(),
  };
  const assignmentRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const journalRepo = {
    find: jest.fn(),
  };
  const studentRepo = {
    findOne: jest.fn(),
  };
  const userRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const service = new AdminAssessmentService(
    access as never,
    results as never,
    examRepo as never,
    attemptRepo as never,
    resultRepo as never,
    assignmentRepo as never,
    journalRepo as never,
    studentRepo as never,
    userRepo as never,
  );

  const admin = { sub: 'admin-1', role: 'admin', email: 'a@t' };
  const teacher = { sub: 'teacher-1', role: 'teacher', email: 't@t' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects non-admin from listExams', async () => {
    access.isAdmin.mockReturnValue(false);
    await expect(service.listExams(teacher as never, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects non-admin from listAttempts', async () => {
    access.isAdmin.mockReturnValue(false);
    await expect(
      service.listAttempts(teacher as never, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects non-admin from attempt detail', async () => {
    access.isAdmin.mockReturnValue(false);
    await expect(
      service.getAttemptDetail(teacher as never, 'att-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns attempt detail with review, null auto_score and score history', async () => {
    access.isAdmin.mockReturnValue(true);
    attemptRepo.findOne.mockResolvedValue({
      id: 'att-1',
      examId: 'exam-1',
      assignmentId: 'asg-1',
      studentId: 'stu-1',
      teacherId: null,
      userId: 'u-stu',
      status: 'submitted',
      attemptNumber: 1,
      startedAt: new Date('2026-01-01T10:00:00Z'),
      submittedAt: new Date('2026-01-01T10:30:00Z'),
      expiresAt: null,
      createdAt: new Date('2026-01-01T09:00:00Z'),
    });
    examRepo.findOne.mockResolvedValue({
      id: 'exam-1',
      name: 'HSK Mock',
      status: 'published',
      source: 'assessment',
      description: null,
      createdByUserId: 'creator-1',
      createdAt: new Date(),
    });
    assignmentRepo.findOne.mockResolvedValue({
      id: 'asg-1',
      targetType: 'student',
      targetId: 'stu-1',
      status: 'active',
      assignedByUserId: 'teacher-assigner',
      createdAt: new Date(),
      validFrom: null,
      validTo: null,
    });
    studentRepo.findOne.mockResolvedValue({
      id: 'stu-1',
      firstName: 'Анна',
      lastName: 'Иванова',
    });
    userRepo.findOne
      .mockResolvedValueOnce({
        id: 'teacher-assigner',
        firstName: 'Пётр',
        lastName: 'Учитель',
      })
      .mockResolvedValueOnce({
        id: 'creator-1',
        firstName: 'Автор',
        lastName: 'Экзамена',
      });

    const resultEntity = {
      id: 'res-1',
      attemptId: 'att-1',
      examId: 'exam-1',
      status: ResultStatus.Passed,
      score: '9',
      autoScore: null,
      scoreSource: ScoreSource.Manual,
      maxScore: '10',
      percent: '90.00',
      passed: true,
      breakdowns: [],
    };
    resultRepo.findOne.mockResolvedValue(resultEntity);
    results.getReviewBundle.mockResolvedValue({
      result: resultEntity,
      reviewStatus: 'reviewed',
      items: [
        {
          questionSnapshotId: 'qs-1',
          stem: 'Translate',
          type: 'short_text',
          points: 10,
          score: 8,
          requiresManualReview: true,
          textAnswer: '你好',
          reviewComment: 'Хорошо',
          selectedAnswerSnapshotIds: [],
          answerOptions: [],
        },
      ],
      manualPendingCount: 0,
      canAdjustFinalScore: true,
    });
    journalRepo.find.mockResolvedValue([
      {
        id: 'j1',
        actorUserId: 'admin-1',
        summary: 'Final score 8 → 9',
        createdAt: new Date('2026-01-02T12:00:00Z'),
        oldVersion: JSON.stringify({ score: '8', auto_score: null }),
        newVersion: JSON.stringify({
          score: '9',
          auto_score: null,
          reason: 'Корректировка',
        }),
      },
    ]);
    userRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 'admin-1', firstName: 'Админ', lastName: 'Системы' },
      ]),
    });

    const detail = await service.getAttemptDetail(admin as never, 'att-1');

    expect(detail.exam.name).toBe('HSK Mock');
    expect(detail.student?.name).toBe('Анна Иванова');
    expect(detail.assignment?.assigned_by_name).toBe('Пётр Учитель');
    expect(detail.can_adjust_final_score).toBe(true);
    expect(detail.items).toHaveLength(1);
    expect(detail.result?.autoScore).toBeNull();
    expect(detail.score_history).toHaveLength(1);
    expect(detail.score_history[0].old_score).toBe('8');
    expect(detail.score_history[0].new_score).toBe('9');
    expect(detail.score_history[0].reason).toBe('Корректировка');
    expect(detail.score_history[0].actor_name).toBe('Админ Системы');
  });

  it('throws NotFound for missing attempt', async () => {
    access.isAdmin.mockReturnValue(true);
    attemptRepo.findOne.mockResolvedValue(null);
    await expect(
      service.getAttemptDetail(admin as never, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
