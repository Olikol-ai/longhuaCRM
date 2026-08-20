import { TeacherTomorrowDigestJobsService } from './teacher-tomorrow-digest-jobs.service';

describe('TeacherTomorrowDigestJobsService', () => {
  function buildService(overrides: {
    lessons?: unknown[];
    sendMessage?: jest.Mock;
    digestInsert?: jest.Mock;
    digestDelete?: jest.Mock;
    teacher?: { id: string; telegramId?: string | null; userId?: string | null } | null;
    user?: { id: string; telegramId?: string | null } | null;
  } = {}) {
    const sendMessage =
      overrides.sendMessage ?? jest.fn().mockResolvedValue({ ok: true });
    const digestInsert =
      overrides.digestInsert ?? jest.fn().mockResolvedValue(undefined);
    const digestDelete =
      overrides.digestDelete ?? jest.fn().mockResolvedValue(undefined);

    const lessonRepo = {
      find: jest.fn().mockResolvedValue(overrides.lessons ?? []),
    };
    const teacherRepo = {
      findOne: jest.fn().mockResolvedValue(
        overrides.teacher === undefined
          ? { id: 't1', telegramId: '1001', userId: null }
          : overrides.teacher,
      ),
    };
    const tutorRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const studentRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 's1', name: 'Иван Петров' }),
      find: jest.fn().mockResolvedValue([]),
    };
    const groupRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const contactRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const tutorStudentRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(overrides.user ?? null),
    };
    const digestRepo = {
      insert: digestInsert,
      delete: digestDelete,
    };
    const gateway = { sendMessage };
    const confirmations = {
      resolveParticipantStudentIds: jest.fn().mockResolvedValue(['s1']),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'jobs.reminderTimezone') return 'Europe/Minsk';
        if (key === 'jobs.enabled') return true;
        if (key === 'telegram.enabled') return true;
        return undefined;
      }),
    };

    const service = new TeacherTomorrowDigestJobsService(
      config as never,
      gateway as never,
      confirmations as never,
      lessonRepo as never,
      teacherRepo as never,
      tutorRepo as never,
      studentRepo as never,
      groupRepo as never,
      contactRepo as never,
      tutorStudentRepo as never,
      userRepo as never,
      digestRepo as never,
    );

    return { service, sendMessage, digestInsert, digestDelete, lessonRepo };
  }

  it('sends one digest for teacher with tomorrow lessons', async () => {
    const { service, sendMessage, digestInsert } = buildService({
      lessons: [
        {
          id: 'l1',
          teacherId: 't1',
          tutorId: null,
          date: '2026-08-08',
          startTime: '10:30:00',
          status: 'planned',
          lessonFormat: 'online',
          lessonType: 'individual',
          primaryStudentId: 's1',
          groupId: null,
          primaryTeacherStudentContactId: null,
          primaryTutorStudentId: null,
        },
        {
          id: 'l2',
          teacherId: 't1',
          tutorId: null,
          date: '2026-08-08',
          startTime: '09:00:00',
          status: 'planned',
          lessonFormat: 'offline',
          lessonType: 'individual',
          primaryStudentId: 's1',
          groupId: null,
          primaryTeacherStudentContactId: null,
          primaryTutorStudentId: null,
        },
      ],
    });

    const result = await service.runSendTeacherTomorrowDigests(
      new Date('2026-08-07T16:00:00Z'),
    );

    expect(result.scheduleDate).toBe('2026-08-08');
    expect(result.sent).toBe(1);
    expect(digestInsert).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const text = String(sendMessage.mock.calls[0][1]);
    expect(text).toContain('09:00');
    expect(text).toContain('10:30');
    // sorted by time: 09:00 before 10:30
    expect(text.indexOf('09:00')).toBeLessThan(text.indexOf('10:30'));
  });

  it('skips when there are no planned lessons tomorrow', async () => {
    const { service, sendMessage } = buildService({
      lessons: [],
    });

    const result = await service.runSendTeacherTomorrowDigests(
      new Date('2026-08-07T16:00:00Z'),
    );
    expect(result.sent).toBe(0);
    expect(result.recipients).toBe(0);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does not resend when digest slot already claimed', async () => {
    const digestInsert = jest.fn().mockRejectedValue(
      Object.assign(new Error('duplicate'), {
        driverError: { code: '23505' },
        code: '23505',
      }),
    );
    // Make it look like QueryFailedError for isUniqueViolation — use code on error
    const { QueryFailedError } = await import('typeorm');
    const uniqueErr = Object.assign(
      new QueryFailedError('INSERT', [], new Error('dup')),
      { driverError: { code: '23505' } },
    );
    digestInsert.mockRejectedValue(uniqueErr);

    const { service, sendMessage } = buildService({
      digestInsert,
      lessons: [
        {
          id: 'l1',
          teacherId: 't1',
          tutorId: null,
          date: '2026-08-08',
          startTime: '09:00:00',
          status: 'planned',
          lessonFormat: 'online',
          lessonType: 'individual',
          primaryStudentId: 's1',
          groupId: null,
          primaryTeacherStudentContactId: null,
          primaryTutorStudentId: null,
        },
      ],
    });

    const result = await service.runSendTeacherTomorrowDigests(
      new Date('2026-08-07T16:00:00Z'),
    );
    expect(result.skippedDuplicate).toBe(1);
    expect(result.sent).toBe(0);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('continues after one teacher send failure and releases claim', async () => {
    const digestDelete = jest.fn().mockResolvedValue(undefined);
    const sendMessage = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, description: 'bot blocked' })
      .mockResolvedValueOnce({ ok: true });

    const lessonRepoFind = jest.fn().mockResolvedValue([
      {
        id: 'l1',
        teacherId: 't1',
        tutorId: null,
        date: '2026-08-08',
        startTime: '09:00:00',
        status: 'planned',
        lessonFormat: 'online',
        lessonType: 'individual',
        primaryStudentId: 's1',
        groupId: null,
        primaryTeacherStudentContactId: null,
        primaryTutorStudentId: null,
      },
      {
        id: 'l2',
        teacherId: 't2',
        tutorId: null,
        date: '2026-08-08',
        startTime: '11:00:00',
        status: 'planned',
        lessonFormat: 'online',
        lessonType: 'individual',
        primaryStudentId: 's1',
        groupId: null,
        primaryTeacherStudentContactId: null,
        primaryTutorStudentId: null,
      },
    ]);

    const teacherFindOne = jest
      .fn()
      .mockResolvedValueOnce({ id: 't1', telegramId: '1001', userId: null })
      .mockResolvedValueOnce({ id: 't2', telegramId: '1002', userId: null });

    const service = new TeacherTomorrowDigestJobsService(
      {
        get: jest.fn((key: string) =>
          key === 'jobs.reminderTimezone' ? 'Europe/Minsk' : true,
        ),
      } as never,
      { sendMessage } as never,
      {
        resolveParticipantStudentIds: jest.fn().mockResolvedValue(['s1']),
      } as never,
      { find: lessonRepoFind } as never,
      { findOne: teacherFindOne } as never,
      { findOne: jest.fn() } as never,
      {
        findOne: jest.fn().mockResolvedValue({ id: 's1', name: 'Иван' }),
        find: jest.fn().mockResolvedValue([]),
      } as never,
      { findOne: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      {
        insert: jest.fn().mockResolvedValue(undefined),
        delete: digestDelete,
      } as never,
    );

    const result = await service.runSendTeacherTomorrowDigests(
      new Date('2026-08-07T16:00:00Z'),
    );
    expect(result.errors).toBe(1);
    expect(result.sent).toBe(1);
    expect(digestDelete).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('queries only planned lessons for tomorrow digest', async () => {
    const { service, sendMessage, lessonRepo } = buildService({ lessons: [] });
    const result = await service.runSendTeacherTomorrowDigests(
      new Date('2026-08-07T16:00:00Z'),
    );
    expect(lessonRepo.find).toHaveBeenCalled();
    const where = lessonRepo.find.mock.calls[0][0].where;
    expect(where.status).toBe('planned');
    expect(where.date).toBe('2026-08-08');
    expect(result.sent).toBe(0);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('dryRun builds previews without sending or claiming', async () => {
    const { service, sendMessage, digestInsert } = buildService({
      lessons: [
        {
          id: 'l1',
          teacherId: 't1',
          tutorId: null,
          date: '2026-08-08',
          startTime: '09:00:00',
          status: 'planned',
          lessonFormat: 'online',
          lessonType: 'individual',
          primaryStudentId: 's1',
          groupId: null,
          primaryTeacherStudentContactId: null,
          primaryTutorStudentId: null,
        },
      ],
    });

    const result = await service.runSendTeacherTomorrowDigests(
      new Date('2026-08-07T16:00:00Z'),
      { dryRun: true },
    );

    expect(result.dryRun).toBe(true);
    expect(result.sent).toBe(1);
    expect(result.previews).toHaveLength(1);
    expect(result.previews[0].text).toContain('09:00');
    expect(sendMessage).not.toHaveBeenCalled();
    expect(digestInsert).not.toHaveBeenCalled();
  });
});
