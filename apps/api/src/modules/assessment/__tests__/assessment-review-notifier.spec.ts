import { AssessmentReviewNotifier } from '../services/assessment-review-notifier.service';
import { ASSESSMENT_RESULT_REVIEWED } from '../events/assessment-result.events';
import { ResultStatus } from '../enums';

describe('AssessmentReviewNotifier student notify', () => {
  const notifications = { create: jest.fn() };
  const telegram = { sendMessage: jest.fn() };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'appPublicUrl') return 'https://crm.example';
      if (key === 'port') return 3001;
      return undefined;
    }),
  };
  const attemptsRepo = {
    findById: jest.fn(),
    findQuestionSnapshotsByAttemptId: jest.fn(),
  };
  const students = { findOne: jest.fn() };
  const teachers = { findOne: jest.fn() };
  const users = { findOne: jest.fn() };
  const exams = { findOne: jest.fn() };

  const notifier = new AssessmentReviewNotifier(
    notifications as never,
    telegram as never,
    config as never,
    attemptsRepo as never,
    students as never,
    teachers as never,
    users as never,
    exams as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('notifies student in-app and Telegram after review', async () => {
    attemptsRepo.findById.mockResolvedValue({
      id: 'att-1',
      userId: 'user-student',
      studentId: 'stu-1',
    });
    students.findOne.mockResolvedValue({
      id: 'stu-1',
      userId: 'user-student',
      telegramId: 'tg-123',
    });
    users.findOne.mockResolvedValue({ id: 'user-student', telegramId: 'tg-123' });
    exams.findOne.mockResolvedValue({ id: 'exam-1', name: 'HSK 1' });
    telegram.sendMessage.mockResolvedValue({ ok: true });

    await notifier.onReviewed({
      id: 'res-1',
      attemptId: 'att-1',
      examId: 'exam-1',
      status: ResultStatus.Passed,
      passed: true,
      percent: '90.00',
    } as never);

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-student',
        channel: 'in_app',
        type: 'assessment_reviewed',
        title: 'Ваш экзамен проверен.',
      }),
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      'tg-123',
      expect.stringContaining('Ваш экзамен проверен.'),
    );
    expect(ASSESSMENT_RESULT_REVIEWED).toBe('assessment.result.reviewed');
  });
});
