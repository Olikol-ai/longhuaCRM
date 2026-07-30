import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoService } from '../video.service';
import { JitsiJwtService } from '../providers/jitsi-jwt.service';
import { JitsiVideoProvider } from '../providers/jitsi-video.provider';
import { LessonEntity } from '../../lessons/entities/lesson.entity';

describe('VideoService', () => {
  const configMap: Record<string, string | number> = {
    'video.jitsiBaseUrl': 'https://meet.example.test',
    'video.jitsiJwtAppId': 'longhua_crm',
    'video.jitsiJwtAppSecret': 'secret-test-key',
    'video.jitsiJwtTtlSeconds': 900,
    appPublicUrl: 'https://crm.example.com',
  };
  const config = {
    get: jest.fn((key: string) => configMap[key]),
  } as unknown as ConfigService;
  const jitsiJwt = new JitsiJwtService(config);
  const provider = new JitsiVideoProvider(config, jitsiJwt);

  const lessons = {
    findOne: jest.fn(),
    save: jest.fn(async (lesson: LessonEntity) => lesson),
  };
  const teachers = { findOne: jest.fn() };
  const students = { findOne: jest.fn() };
  const users = { findOne: jest.fn() };
  const attendance = { find: jest.fn().mockResolvedValue([]) };
  const chats = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((row: unknown) => row),
  };
  const chatMembers = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((row: unknown) => row),
  };
  const lessonAccess = {
    assertCanReadLesson: jest.fn(),
  };

  const service = new VideoService(
    provider,
    lessons as never,
    teachers as never,
    students as never,
    users as never,
    attendance as never,
    chats as never,
    chatMembers as never,
    lessonAccess as never,
    config,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    users.findOne.mockResolvedValue({
      id: 'user-1',
      firstName: 'Иван',
      lastName: 'Иванов',
      email: 'ivan@test.local',
      avatarFilePath: null,
      avatarThumbPath: null,
    });
    attendance.find.mockResolvedValue([]);
  });

  function onlineLesson(overrides: Partial<LessonEntity> = {}): LessonEntity {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return {
      id: 'lesson-uuid-1',
      lessonFormat: 'online',
      date,
      startTime,
      duration: 60,
      status: 'planned',
      videoProvider: null,
      videoRoomId: null,
      videoRoomUrl: null,
      meetingLink: null,
      teacher: { name: 'Учитель Тест', firstName: null, lastName: null, userId: 'teacher-user' },
      primaryStudent: {
        id: 'stu-1',
        name: 'Ученик Тест',
        firstName: null,
        lastName: null,
        userId: 'student-user',
      },
      ...overrides,
    } as LessonEntity;
  }

  it('creates UUID room and CRM join URL', async () => {
    const lesson = onlineLesson();
    const saved = await service.ensureLessonVideo(lesson);

    expect(saved.videoProvider).toBe('jitsi');
    expect(saved.videoRoomId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(saved.videoRoomUrl).toContain(saved.videoRoomId as string);
    expect(saved.meetingLink).toBe(
      'https://crm.example.com/lesson/lesson-uuid-1/video',
    );
    expect(lessons.save).toHaveBeenCalledTimes(1);
  });

  it('rotates legacy longhua-{id} rooms to UUID', async () => {
    const lesson = onlineLesson({
      videoProvider: 'jitsi',
      videoRoomId: 'longhua-lesson-uuid-1',
      videoRoomUrl: 'https://meet.example.test/longhua-lesson-uuid-1',
    });
    const saved = await service.ensureLessonVideo(lesson);
    expect(saved.videoRoomId).not.toMatch(/^longhua-/);
    expect(lessons.save).toHaveBeenCalled();
  });

  it('does not recreate modern UUID room when fields already set', async () => {
    const lesson = onlineLesson({
      videoProvider: 'jitsi',
      videoRoomId: '11111111-1111-4111-8111-111111111111',
      videoRoomUrl:
        'https://meet.example.test/11111111-1111-4111-8111-111111111111',
    });
    const result = await service.ensureLessonVideo(lesson);
    expect(lessons.save).not.toHaveBeenCalled();
    expect(result.videoRoomId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('skips offline lessons', async () => {
    const lesson = onlineLesson({ lessonFormat: 'offline' });
    const result = await service.ensureLessonVideo(lesson);
    expect(result.videoRoomId).toBeNull();
    expect(lessons.save).not.toHaveBeenCalled();
  });

  it('allows teacher access with JWT and role in display name', async () => {
    const lesson = onlineLesson({
      videoProvider: 'jitsi',
      videoRoomId: '11111111-1111-4111-8111-111111111111',
      videoRoomUrl:
        'https://meet.example.test/11111111-1111-4111-8111-111111111111',
    });
    lessonAccess.assertCanReadLesson.mockResolvedValue(lesson);
    lessons.findOne.mockResolvedValue(lesson);

    const access = await service.getLessonVideoAccess(
      { sub: 'teacher-user', role: 'teacher', email: 't@test.local' },
      'lesson-uuid-1',
    );

    expect(access.token).toBeTruthy();
    expect(access.jwt_required).toBe(true);
    expect(access.is_host).toBe(true);
    expect(access.display_name).toContain('преподаватель');
    expect(access.domain).toBe('meet.example.test');
  });

  it('allows student access inside time window', async () => {
    const lesson = onlineLesson({
      videoProvider: 'jitsi',
      videoRoomId: '11111111-1111-4111-8111-111111111111',
      videoRoomUrl:
        'https://meet.example.test/11111111-1111-4111-8111-111111111111',
    });
    lessonAccess.assertCanReadLesson.mockResolvedValue(lesson);
    lessons.findOne.mockResolvedValue(lesson);

    const access = await service.getLessonVideoAccess(
      { sub: 'student-user', role: 'student', email: 's@test.local' },
      'lesson-uuid-1',
    );

    expect(access.token).toBeTruthy();
    expect(access.is_host).toBe(false);
    expect(access.crm_join_url).toContain('/lesson/lesson-uuid-1/video');
  });

  it('blocks student outside time window', async () => {
    const lesson = onlineLesson({
      videoProvider: 'jitsi',
      videoRoomId: '11111111-1111-4111-8111-111111111111',
      videoRoomUrl:
        'https://meet.example.test/11111111-1111-4111-8111-111111111111',
      date: '2020-01-01',
      startTime: '10:00',
    });
    lessonAccess.assertCanReadLesson.mockResolvedValue(lesson);
    lessons.findOne.mockResolvedValue(lesson);

    await expect(
      service.getLessonVideoAccess(
        { sub: 'student-user', role: 'student', email: 's@test.local' },
        'lesson-uuid-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rewrites stale room URL to current host', async () => {
    const lesson = onlineLesson({
      videoProvider: 'jitsi',
      videoRoomId: '11111111-1111-4111-8111-111111111111',
      videoRoomUrl:
        'https://old.example.test/11111111-1111-4111-8111-111111111111',
    });
    lessonAccess.assertCanReadLesson.mockResolvedValue(lesson);
    lessons.findOne.mockResolvedValue(lesson);

    const access = await service.getLessonVideoAccess(
      { sub: 'teacher-user', role: 'teacher', email: 't@test.local' },
      'lesson-uuid-1',
    );

    expect(access.room_url).toBe(
      'https://meet.example.test/11111111-1111-4111-8111-111111111111',
    );
    expect(lessons.save).toHaveBeenCalled();
  });

  it('denies strangers via LessonAccessService', async () => {
    lessonAccess.assertCanReadLesson.mockRejectedValue(
      new ForbiddenException('Cannot access another student lesson'),
    );

    await expect(
      service.getLessonVideoAccess(
        { sub: 'other-user', role: 'student', email: 'other@test.local' },
        'lesson-uuid-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
