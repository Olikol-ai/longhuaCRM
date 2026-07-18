import { AssessmentTimeoutJobService } from '../services/assessment-timeout-job.service';
import { AttemptService } from '../services/attempt.service';
import { AttemptStatus, ResultStatus, SubmitReason } from '../enums';
import {
  AssessmentAttemptRepository,
  AssessmentExamRepository,
} from '../repositories';
import { ConfigService } from '@nestjs/config';

describe('AssessmentTimeoutJobService', () => {
  const attempts = {
    findExpiredStartedAttempts: jest.fn(),
  } as unknown as jest.Mocked<AssessmentAttemptRepository>;

  const exams = {
    findRuleByExamId: jest.fn(),
  } as unknown as jest.Mocked<AssessmentExamRepository>;

  const attemptService = {
    submit: jest.fn(),
  } as unknown as jest.Mocked<AttemptService>;

  const config = {
    get: jest.fn().mockReturnValue(true),
  } as unknown as jest.Mocked<ConfigService>;

  const job = new AssessmentTimeoutJobService(
    attempts,
    exams,
    attemptService,
    config,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(true);
  });

  it('timeout auto submits attempt', async () => {
    const now = new Date('2026-01-01T12:00:00Z');
    attempts.findExpiredStartedAttempts.mockResolvedValue([
      {
        id: 'att-1',
        examId: 'exam-1',
        status: AttemptStatus.Started,
        expiresAt: new Date('2026-01-01T11:00:00Z'),
      },
    ] as never);
    exams.findRuleByExamId.mockResolvedValue({
      autoSubmitOnTimeout: true,
    } as never);
    attemptService.submit.mockResolvedValue({
      attempt: { id: 'att-1', status: AttemptStatus.Submitted },
      result: { id: 'res-1', status: ResultStatus.Passed },
    } as never);

    const count = await job.processExpiredAttempts(now);

    expect(count).toBe(1);
    expect(attemptService.submit).toHaveBeenCalledWith({
      attemptId: 'att-1',
      submitReason: SubmitReason.Timeout,
    });
  });

  it('timeout creates result', async () => {
    attempts.findExpiredStartedAttempts.mockResolvedValue([
      {
        id: 'att-2',
        examId: 'exam-1',
        status: AttemptStatus.Started,
        expiresAt: new Date('2026-01-01T11:00:00Z'),
      },
    ] as never);
    exams.findRuleByExamId.mockResolvedValue({
      autoSubmitOnTimeout: true,
    } as never);

    const result = {
      id: 'res-2',
      status: ResultStatus.Failed,
      attemptId: 'att-2',
    };
    attemptService.submit.mockResolvedValue({
      attempt: {
        id: 'att-2',
        status: AttemptStatus.Submitted,
        submitReason: SubmitReason.Timeout,
      },
      result,
    } as never);

    await job.processExpiredAttempts(new Date('2026-01-01T12:00:00Z'));

    expect(attemptService.submit).toHaveBeenCalled();
    const submitted = await attemptService.submit.mock.results[0].value;
    expect(submitted.result).toEqual(result);
    expect(submitted.attempt.status).toBe(AttemptStatus.Submitted);
    expect(submitted.attempt.submitReason).toBe(SubmitReason.Timeout);
  });

  it('skips when autoSubmitOnTimeout is false', async () => {
    attempts.findExpiredStartedAttempts.mockResolvedValue([
      {
        id: 'att-3',
        examId: 'exam-1',
        status: AttemptStatus.Started,
        expiresAt: new Date('2026-01-01T11:00:00Z'),
      },
    ] as never);
    exams.findRuleByExamId.mockResolvedValue({
      autoSubmitOnTimeout: false,
    } as never);

    const count = await job.processExpiredAttempts(new Date());
    expect(count).toBe(0);
    expect(attemptService.submit).not.toHaveBeenCalled();
  });
});
