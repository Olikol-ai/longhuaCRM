import { TeacherStudentContactAccessService } from './teacher-student-contact-access.service';

describe('TeacherStudentContactAccessService ACL', () => {
  const teacherAccess = {
    resolveTeacherId: jest.fn(),
  };
  const tutorAccess = {
    resolveTutorId: jest.fn(),
  };
  const contactRepo = {
    findOne: jest.fn(),
  };

  const service = new TeacherStudentContactAccessService(
    contactRepo as never,
    teacherAccess as never,
    tutorAccess as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows owner to list own contacts', async () => {
    teacherAccess.resolveTeacherId.mockResolvedValue('teacher-1');
    await expect(
      service.assertCanList(
        { sub: 'u1', email: 't@test.local', role: 'teacher' },
        'teacher',
        'teacher-1',
      ),
    ).resolves.toBeUndefined();
  });

  it('forbids teacher from listing another teacher contacts', async () => {
    teacherAccess.resolveTeacherId.mockResolvedValue('teacher-1');
    await expect(
      service.assertCanList(
        { sub: 'u1', email: 't@test.local', role: 'teacher' },
        'teacher',
        'teacher-other',
      ),
    ).rejects.toThrow(/только своих/);
  });

  it('admin can write any contact', async () => {
    contactRepo.findOne.mockResolvedValue({
      id: 'c-1',
      ownerType: 'teacher',
      ownerId: 'teacher-9',
      status: 'active',
    });
    const row = await service.assertCanWrite(
      { sub: 'admin', email: 'a@test.local', role: 'admin' },
      'c-1',
    );
    expect(row.id).toBe('c-1');
    expect(teacherAccess.resolveTeacherId).not.toHaveBeenCalled();
  });
});
