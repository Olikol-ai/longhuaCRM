import { ResultStatus, AssignmentTargetType } from '../../assessment/enums';
import { AssessmentCertificateService } from '../assessment-certificate.service';
import { CertificateEntity } from '../entities/certificate.entity';
import { CertificateHistoryEntity } from '../entities/certificate-history.entity';

describe('AssessmentCertificateService', () => {
  const certificates = {
    findByAssessmentResultId: jest.fn(),
    findActiveByStudentAndCourse: jest.fn(),
    findByBlankSeriesAndNumber: jest.fn(),
  };

  const issuedNotifier = {
    notifyAssessmentIssued: jest.fn(),
  };

  const resultsRepo = { findOne: jest.fn() };
  const attemptsRepo = { findOne: jest.fn() };
  const assignmentsRepo = { findOne: jest.fn() };
  const examsRepo = { findOne: jest.fn() };
  const enrollmentsRepo = { find: jest.fn() };
  const coursesRepo = { findOne: jest.fn() };

  const certRepo = {
    findOne: jest.fn(),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'cert-1', ...x })),
  };
  const historyRepo = {
    save: jest.fn(async (x: unknown) => x),
  };

  const dataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
      fn({
        getRepository: (entity: unknown) => {
          if (entity === CertificateHistoryEntity) {
            return historyRepo;
          }
          if (entity === CertificateEntity) {
            return certRepo;
          }
          return certRepo;
        },
      }),
    ),
  };

  const service = new AssessmentCertificateService(
    certificates as never,
    issuedNotifier as never,
    dataSource as never,
    resultsRepo as never,
    attemptsRepo as never,
    assignmentsRepo as never,
    examsRepo as never,
    enrollmentsRepo as never,
    coursesRepo as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    certificates.findByBlankSeriesAndNumber.mockResolvedValue(null);
    examsRepo.findOne.mockResolvedValue({ id: 'exam-1', name: 'HSK Demo 1' });
    coursesRepo.findOne.mockResolvedValue({ id: 'course-1', name: 'HSK 1' });
    certRepo.findOne.mockResolvedValue(null);
  });

  function passedResult(overrides: Record<string, unknown> = {}) {
    return {
      id: 'result-1',
      attemptId: 'attempt-1',
      examId: 'exam-1',
      status: ResultStatus.Passed,
      passed: true,
      finishedAt: new Date('2026-07-01T12:00:00Z'),
      ...overrides,
    };
  }

  it('creates Certificate for passed Result', async () => {
    certificates.findByAssessmentResultId.mockResolvedValue(null);
    certificates.findActiveByStudentAndCourse.mockResolvedValue(null);
    attemptsRepo.findOne.mockResolvedValue({
      id: 'attempt-1',
      studentId: 'student-1',
      assignmentId: 'assign-1',
      examId: 'exam-1',
    });
    assignmentsRepo.findOne.mockResolvedValue({
      id: 'assign-1',
      targetType: AssignmentTargetType.Course,
      targetId: 'course-1',
    });

    const cert = await service.issueForPassedResult(passedResult() as never);

    expect(cert).toBeTruthy();
    expect(cert?.status).toBe('issued');
    expect(cert?.source).toBe('assessment');
    expect(cert?.assessmentResultId).toBe('result-1');
    expect(cert?.studentId).toBe('student-1');
    expect(cert?.courseId).toBe('course-1');
    expect(cert?.blankSeries).toBe('LH-A');
    expect(issuedNotifier.notifyAssessmentIssued).toHaveBeenCalled();
  });

  it('does not create a second Certificate for the same Result', async () => {
    const existing = {
      id: 'cert-existing',
      assessmentResultId: 'result-1',
      status: 'issued',
    };
    certificates.findByAssessmentResultId.mockResolvedValue(existing);

    const cert = await service.issueForPassedResult(passedResult() as never);

    expect(cert).toEqual(existing);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(issuedNotifier.notifyAssessmentIssued).not.toHaveBeenCalled();
  });

  it('does not create Certificate for failed Result', async () => {
    const cert = await service.issueForPassedResult(
      passedResult({ status: ResultStatus.Failed, passed: false }) as never,
    );

    expect(cert).toBeNull();
    expect(certificates.findByAssessmentResultId).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('revokes Certificate when Result is invalidated', async () => {
    certificates.findByAssessmentResultId.mockResolvedValue({
      id: 'cert-1',
      status: 'issued',
      assessmentResultId: 'result-1',
    });
    certRepo.findOne.mockResolvedValue({
      id: 'cert-1',
      status: 'issued',
      assessmentResultId: 'result-1',
    });
    certRepo.save.mockImplementation(async (row: Record<string, unknown>) => ({
      id: 'cert-1',
      ...row,
    }));

    const revoked = await service.revokeForInvalidatedResult('result-1');

    expect(revoked?.status).toBe('revoked');
    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'revoked' }),
    );
  });
});
