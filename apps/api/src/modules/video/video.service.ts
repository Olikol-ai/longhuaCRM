import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonAccessService } from '../../common/access/lesson-access.service';
import { JwtPayload } from '../auth/auth.service';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from '../users/entities/user.entity';
import { composeDisplayName } from '../users/display-name.util';
import {
  VIDEO_PROVIDER,
  VideoProvider,
} from './providers/video-provider.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class VideoService {
  constructor(
    @Inject(VIDEO_PROVIDER) private readonly provider: VideoProvider,
    @InjectRepository(LessonEntity)
    private readonly lessons: Repository<LessonEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachers: Repository<TeacherEntity>,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly lessonAccess: LessonAccessService,
    private readonly config: ConfigService,
  ) {}

  buildCrmJoinUrl(lessonId: string): string {
    const base = (
      this.config.get<string>('appPublicUrl') ||
      process.env.APP_PUBLIC_URL ||
      ''
    ).replace(/\/$/, '');
    if (!base) {
      return `/lesson/${lessonId}/video`;
    }
    return `${base}/lesson/${lessonId}/video`;
  }

  /**
   * Allocate provider room fields on an online lesson (idempotent).
   */
  async ensureLessonVideo(lesson: LessonEntity): Promise<LessonEntity> {
    if (lesson.lessonFormat !== 'online') {
      return lesson;
    }
    if (lesson.videoRoomId && lesson.videoRoomUrl) {
      return lesson;
    }

    const room = await this.provider.createRoom({ id: lesson.id });
    lesson.videoProvider = room.provider;
    lesson.videoRoomId = room.roomId;
    lesson.videoRoomUrl = room.roomUrl;
    if (!lesson.meetingLink) {
      lesson.meetingLink = this.buildCrmJoinUrl(lesson.id);
    }
    return this.lessons.save(lesson);
  }

  async getLessonVideoAccess(actor: JwtPayload, lessonId: string) {
    await this.lessonAccess.assertCanReadLesson(actor, lessonId);
    let lesson = await this.lessons.findOne({
      where: { id: lessonId },
      relations: ['teacher', 'primaryStudent'],
    });
    if (!lesson) {
      throw new NotFoundException('Урок не найден');
    }
    if (lesson.lessonFormat !== 'online') {
      throw new ForbiddenException('Видео доступно только для онлайн-уроков');
    }

    lesson = await this.ensureLessonVideo(lesson);

    const displayName = await this.resolveDisplayName(actor);
    const access = await this.provider.generateAccessData({
      roomId: lesson.videoRoomId as string,
      roomUrl: lesson.videoRoomUrl as string,
      displayName,
    });

    const teacherName =
      lesson.teacher?.name?.trim() ||
      composeDisplayName(lesson.teacher?.firstName, lesson.teacher?.lastName, 'Преподаватель');

    const window = this.resolveLessonWindow(lesson);

    return {
      lesson_id: lesson.id,
      provider: access.provider,
      room_id: access.roomId,
      room_url: access.roomUrl,
      embed_url: access.embedUrl,
      display_name: access.displayName,
      token: access.token,
      crm_join_url: this.buildCrmJoinUrl(lesson.id),
      lesson: {
        id: lesson.id,
        date: lesson.date,
        start_time: lesson.startTime,
        duration: lesson.duration,
        status: lesson.status,
        lesson_format: lesson.lessonFormat,
        teacher_name: teacherName,
        student_name:
          lesson.primaryStudent?.name?.trim() ||
          composeDisplayName(
            lesson.primaryStudent?.firstName,
            lesson.primaryStudent?.lastName,
            '',
          ) ||
          null,
      },
      timing: window,
    };
  }

  resolveLessonWindow(lesson: LessonEntity): {
    starts_at: string;
    ends_at: string;
    can_join: boolean;
    phase: 'before' | 'during' | 'after';
    minutes_until_start: number;
  } {
    const start = this.getLessonStart(lesson);
    const end = new Date(start.getTime() + (lesson.duration || 60) * 60_000);
    const now = Date.now();
    // Allow join 10 minutes before start through end + 30 minutes grace.
    const joinFrom = start.getTime() - 10 * 60_000;
    const joinUntil = end.getTime() + 30 * 60_000;
    const minutesUntilStart = Math.round((start.getTime() - now) / 60_000);

    let phase: 'before' | 'during' | 'after' = 'during';
    if (now < start.getTime()) phase = 'before';
    else if (now > end.getTime()) phase = 'after';

    return {
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      can_join: now >= joinFrom && now <= joinUntil,
      phase,
      minutes_until_start: minutesUntilStart,
    };
  }

  private getLessonStart(lesson: LessonEntity): Date {
    const [year, month, day] = String(lesson.date || '').split('-').map(Number);
    const [hours, minutes] = String(lesson.startTime || '00:00')
      .split(':')
      .map(Number);
    return new Date(year, month - 1, day, hours, minutes || 0);
  }

  private async resolveDisplayName(actor: JwtPayload): Promise<string> {
    const user = await this.users.findOne({ where: { id: actor.sub } });
    if (user) {
      const composed = composeDisplayName(user.firstName, user.lastName, user.email);
      if (composed) return composed;
    }
    if (actor.role === 'teacher') {
      const teacher = await this.teachers.findOne({ where: { userId: actor.sub } });
      if (teacher?.name?.trim()) return teacher.name.trim();
    }
    if (actor.role === 'student') {
      const student = await this.students.findOne({ where: { userId: actor.sub } });
      if (student?.name?.trim()) return student.name.trim();
    }
    return actor.email || 'Участник';
  }
}
