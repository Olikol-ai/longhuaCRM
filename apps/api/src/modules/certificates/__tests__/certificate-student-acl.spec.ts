import { CertificateAccessService } from '../../../common/access/certificate-access.service';
import { NO_ACCESS_UUID } from '../../../common/access/access.constants';

describe('CertificateAccessService student scope', () => {
  const certificateRepo = { findOne: jest.fn() };
  const studentRepo = { find: jest.fn() };
  const teacherRepo = { findOne: jest.fn() };
  const studentAccess = {
    resolveStudentId: jest.fn(),
    assertCanReadStudent: jest.fn(),
  };

  const service = new CertificateAccessService(
    certificateRepo as never,
    studentRepo as never,
    teacherRepo as never,
    studentAccess as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes list filter to the current student only', async () => {
    studentAccess.resolveStudentId.mockResolvedValue('student-own');

    const scoped = await service.scopeCertificateFilter(
      { sub: 'user-1', role: 'student', email: 's@test.local' },
      {},
    );

    expect(scoped).toEqual({ studentId: 'student-own' });
  });

  it('returns no-access sentinel when student profile is missing', async () => {
    studentAccess.resolveStudentId.mockResolvedValue(null);

    const scoped = await service.scopeCertificateFilter(
      { sub: 'user-1', role: 'student', email: 's@test.local' },
      {},
    );

    expect(scoped).toEqual({ studentId: NO_ACCESS_UUID });
  });
});
