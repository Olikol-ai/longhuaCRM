import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoService } from '../video.service';
import { JitsiVideoProvider } from '../providers/jitsi-video.provider';
import { LessonEntity } from '../../lessons/entities/lesson.entity';

describe('VideoService', () => {
  const provider = new JitsiVideoProvider({
    get: (key: string) => {
      if (key === 'video.jitsiBaseUrl') return 'https://meet.example.test';
      return '';
    },
  } as unknown as ConfigService);

  const lessons = {
    findOne: jest.fn(),
    save: jest.fn(async (lesson: LessonEntity) => lesson),
  };
  const teachers = { findOne: jest.fn() };
  const students = { findOne: jest.fn() };
  const users = { findOne: jest.fn() };
  const lessonAccess = {
    assertCanReadLesson: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'appPublicUrl') return 'https://crm.example.com';
      return undefined;
    }),
  } as unknown as ConfigService;

  const service = new VideoService(
    provider,
    lessons as never,
    teachers as never,
    students as never,
    users as never,
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
    });
  });

  function onlineLesson(overrides: Partial<LessonEntity> = {}): LessonEntity {
    return {
      id: 'lesson-uuid-1',
      lessonFormat: 'online',
      date: '2026-07-28',
      startTime: '12:00',
      duration: 60,
      status: 'planned',
      videoProvider: null,
      videoRoomId: null,
      videoRoomUrl: null,
      meetingLink: null,
      teacher: { name: 'Учитель Тест', firstName: null, lastName: null },
      primaryStudent: { name: 'Ученик Тест', firstName: null, lastName: null },
      ...overrides,
    } as LessonEntity;
  }

  it('creates Jitsi room and saves video_room_id / video_room_url on guest host', async () => {
    const lesson = onlineLesson();
    const saved = await service.ensureLessonVideo(lesson);

    expect(saved.videoProvider).toBe('jitsi');
    expect(saved.videoRoomId).toBe('longhua-lesson-uuid-1');
    expect(saved.videoRoomUrl).toBe(
      'https://meet.example.test/longhua-lesson-uuid-1',
    );
    expect(saved.meetingLink).toBe(
      'https://crm.example.com/lesson/lesson-uuid-1/video',
    );
    expect(lessons.save).toHaveBeenCalledTimes(1);
  });

  it('does not recreate room when fields already set', async () => {
    const lesson = onlineLesson({
      videoProvider: 'jitsi',
      videoRoomId: 'longhua-lesson-uuid-1',
      videoRoomUrl: 'https://meet.example.test/longhua-lesson-uuid-1',
    });
    const result = await service.ensureLessonVideo(lesson);
    expect(lessons.save).not.toHaveBeenCalled();
    expect(result.videoRoomId).toBe('longhua-lesson-uuid-1');
  });

  it('skips offline lessons', async () => {
    const lesson = onlineLesson({ lessonFormat: 'offline' });
    const result = await service.ensureLessonVideo(lesson);
    expect(result.videoRoomId).toBeNull();
    expect(lessons.save).not.toHaveBeenCalled();
  });

  it('allows teacher guest access with role in display name', async () => {
    const lesson = onlineLesson({
      videoProvider: 'jitsi',
      videoRoomId: 'longhua-lesson-uuid-1',
      videoRoomUrl: 'https://meet.example.test/longhua-lesson-uuid-1',
    });
    lessonAccess.assertCanReadLesson.mockResolvedValue(lesson);
    lessons.findOne.mockResolvedValue(lesson);

    const access = await service.getLessonVideoAccess(
      { sub: 'teacher-user', role: 'teacher', email: 't@test.local' },
      'lesson-uuid-1',
    );

    expect(access.room_id).toBe('longhua-lesson-uuid-1');
    expect(access.room_url).toContain('meet.example.test');
    expect(access.guest_access).toBe(true);
    expect(access.host_requires_account).toBe(false);
    expect(access.is_host).toBe(true);
    expect(access.viewer_role).toBe('teacher');
    expect(access.display_name).toContain('преподаватель');
    expect(access.conference_subject).toBeTruthy();
    expect(access.domain).toBe('meet.example.test');
  });

  it('allows student guest access without personal Jitsi account', async () => {
    const lesson = onlineLesson({
      videoProvider: 'jitsi',
      videoRoomId: 'longhua-lesson-uuid-1',
      videoRoomUrl: 'https://meet.example.test/longhua-lesson-uuid-1',
    });
    lessonAccess.assertCanReadLesson.mockResolvedValue(lesson);
    lessons.findOne.mockResolvedValue(lesson);

    const access = await service.getLessonVideoAccess(
      { sub: 'student-user', role: 'student', email: 's@test.local' },
      'lesson-uuid-1',
    );

    expect(access.guest_access).toBe(true);
    expect(access.host_requires_account).toBe(false);
    expect(access.is_host).toBe(false);
    expect(access.viewer_role).toBe('student');
    expect(access.display_name).toContain('ученик');
    expect(access.crm_join_url).toContain('/lesson/lesson-uuid-1/video');
  });

  it('rewrites stale meet.jit.si room URL to current guest host', async () => {
    const lesson = onlineLesson({
      videoProvider: 'jitsi',
      videoRoomId: 'longhua-lesson-uuid-1',
      videoRoomUrl: 'https://meet.jit.si/longhua-lesson-uuid-1',
    });
    lessonAccess.assertCanReadLesson.mockResolvedValue(lesson);
    lessons.findOne.mockResolvedValue(lesson);

    const access = await service.getLessonVideoAccess(
      { sub: 'teacher-user', role: 'teacher', email: 't@test.local' },
      'lesson-uuid-1',
    );

    expect(access.room_url).toBe(
      'https://meet.example.test/longhua-lesson-uuid-1',
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

    expect(lessons.findOne).not.toHaveBeenCalled();
  });
});
