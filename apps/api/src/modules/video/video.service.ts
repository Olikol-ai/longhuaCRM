import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LessonAccessService } from '../../common/access/lesson-access.service';
import { JwtPayload } from '../auth/auth.service';
import { ChatEntity } from '../chats/entities/chat.entity';
import { ChatMemberEntity } from '../chats/entities/chat-member.entity';
import { ChatKind, ChatMemberRole, ChatStatus } from '../chats/enums/chat.enums';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { UserEntity } from '../users/entities/user.entity';
import { composeDisplayName } from '../users/display-name.util';
import {
  VIDEO_PROVIDER,
  VideoProvider,
} from './providers/video-provider.interface';
import { Inject } from '@nestjs/common';

function isLegacyJitsiRoomId(roomId: string | null | undefined): boolean {
  const id = String(roomId || '');
  return /^longhua-/i.test(id) || !id;
}

@Injectable()
export class VideoService {
  constructor(
    @Inject(VIDEO_PROVIDER) private readonly provider: VideoProvider,
    @InjectRepository(LessonEntity)
    private readonly lessons: Repository<LessonEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachers: Repository<TeacherEntity>,
    @InjectRepository(TutorEntity)
    private readonly tutors: Repository<TutorEntity>,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(AttendanceEntity)
    private readonly attendance: Repository<AttendanceEntity>,
    @InjectRepository(ChatEntity)
    private readonly chats: Repository<ChatEntity>,
    @InjectRepository(ChatMemberEntity)
    private readonly chatMembers: Repository<ChatMemberEntity>,
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

  private appPublicBase(): string {
    return (
      this.config.get<string>('appPublicUrl') ||
      process.env.APP_PUBLIC_URL ||
      ''
    ).replace(/\/$/, '');
  }

  buildAvatarUrl(userId: string, hasAvatar: boolean): string | null {
    if (!hasAvatar || !userId) return null;
    const base = this.appPublicBase();
    if (!base) return null;
    return `${base}/api/users/${userId}/avatar?thumb=1`;
  }

  /**
   * Allocate provider room fields on an online lesson (idempotent).
   * Legacy `longhua-{lessonId}` rooms are rotated to random UUIDs on next ensure.
   */
  async ensureLessonVideo(lesson: LessonEntity): Promise<LessonEntity> {
    if (lesson.lessonFormat !== 'online') {
      return lesson;
    }
    if (
      lesson.videoRoomId &&
      lesson.videoRoomUrl &&
      !isLegacyJitsiRoomId(lesson.videoRoomId)
    ) {
      return lesson;
    }

    const room = await this.provider.createRoom({ id: lesson.id });
    lesson.videoProvider = room.provider;
    lesson.videoRoomId = room.roomId;
    lesson.videoRoomUrl = room.roomUrl;
    if (!lesson.meetingLink || /jit\.si|8x8\.vc/i.test(lesson.meetingLink)) {
      lesson.meetingLink = this.buildCrmJoinUrl(lesson.id);
    }
    return this.lessons.save(lesson);
  }

  async getLessonVideoAccess(actor: JwtPayload, lessonId: string) {
    await this.lessonAccess.assertCanReadLesson(actor, lessonId);
    let lesson = await this.lessons.findOne({
      where: { id: lessonId },
      relations: ['teacher', 'primaryStudent', 'group'],
    });
    if (!lesson) {
      throw new NotFoundException('Урок не найден');
    }
    if (lesson.lessonFormat !== 'online') {
      throw new ForbiddenException('Видео доступно только для онлайн-уроков');
    }

    lesson = await this.ensureLessonVideo(lesson);
    lesson = await this.syncLessonVideoUrl(lesson);

    const viewerRole = this.resolveViewerRole(actor.role);
    const isHost = await this.resolveIsLessonHost(actor, lesson);
    const window = this.resolveLessonWindow(lesson);
    if (!window.can_join && !isHost) {
      throw new ForbiddenException(
        'Вход в видеоурок доступен за 10 минут до начала и до 30 минут после окончания',
      );
    }

    const roleLabel = this.roleLabelRu(viewerRole);
    const title = this.resolveLessonTitle(lesson);
    const user = await this.users.findOne({ where: { id: actor.sub } });
    const baseDisplayName = await this.resolveDisplayName(actor, user);
    const displayName = roleLabel
      ? `${baseDisplayName} (${roleLabel})`
      : baseDisplayName;
    const avatarUrl = this.buildAvatarUrl(
      actor.sub,
      Boolean(user?.avatarFilePath || user?.avatarThumbPath),
    );

    const access = await this.provider.generateAccessData({
      roomId: lesson.videoRoomId as string,
      roomUrl: lesson.videoRoomUrl,
      displayName,
      userId: actor.sub,
      email: actor.email,
      avatarUrl,
      roleLabel,
      isModerator: isHost,
      subject: title,
    });

    const teacherName =
      lesson.teacher?.name?.trim() ||
      composeDisplayName(
        lesson.teacher?.firstName,
        lesson.teacher?.lastName,
        'Преподаватель',
      );

    const startLabel = this.formatClock(lesson.startTime);
    const endLabel = this.formatEndClock(
      lesson.startTime,
      lesson.duration || 60,
    );

    return {
      lesson_id: lesson.id,
      provider: access.provider,
      room_id: access.roomId,
      room_url: access.roomUrl,
      embed_url: access.embedUrl,
      display_name: access.displayName,
      token: access.token,
      domain: access.domain,
      room_name: access.roomName,
      external_api_url: access.externalApiUrl,
      host_requires_account: access.hostRequiresAccount,
      crm_join_url: this.buildCrmJoinUrl(lesson.id),
      viewer_role: viewerRole,
      is_host: isHost,
      subject: 'Китайский язык',
      conference_subject: access.subject || title,
      role_label: access.roleLabel,
      guest_access: true,
      jwt_required: true,
      lesson: {
        id: lesson.id,
        title,
        date: lesson.date,
        start_time: lesson.startTime,
        end_time: endLabel,
        start_time_label: startLabel,
        time_range_label: `${startLabel} – ${endLabel}`,
        duration: lesson.duration,
        status: lesson.status,
        lesson_format: lesson.lessonFormat,
        notes: lesson.notes,
        teacher_name: teacherName,
        course_name: null as string | null,
        student_name:
          lesson.primaryStudent?.name?.trim() ||
          composeDisplayName(
            lesson.primaryStudent?.firstName,
            lesson.primaryStudent?.lastName,
            '',
          ) ||
          null,
        group_name: lesson.group?.name?.trim() || null,
      },
      timing: window,
    };
  }

  /**
   * Participants for the lesson side panel (teacher + tutor + attendance students).
   * Live online / join time come from the client (Jitsi presence); CRM provides roster.
   */
  async getLessonParticipants(actor: JwtPayload, lessonId: string) {
    await this.lessonAccess.assertCanReadLesson(actor, lessonId);
    const lesson = await this.lessons.findOne({
      where: { id: lessonId },
      relations: ['teacher', 'tutor', 'primaryStudent'],
    });
    if (!lesson) throw new NotFoundException('Урок не найден');

    const rows = await this.attendance.find({ where: { lessonId } });
    const studentIds = [
      ...new Set(
        [
          ...rows.map((r) => r.studentId),
          lesson.primaryStudentId,
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
    const students =
      studentIds.length > 0
        ? await this.students.find({ where: { id: In(studentIds) } })
        : [];
    const byId = new Map(students.map((s) => [s.id, s]));

    const userIds = new Set<string>();
    if (lesson.teacher?.userId) userIds.add(lesson.teacher.userId);
    if (lesson.tutor?.userId) userIds.add(lesson.tutor.userId);
    for (const student of students) {
      if (student.userId) userIds.add(student.userId);
    }
    const users =
      userIds.size > 0
        ? await this.users.find({ where: { id: In([...userIds]) } })
        : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const participants: Array<{
      role: string;
      name: string;
      user_id?: string | null;
      email?: string | null;
      student_id?: string;
      attendance_id?: string;
      attendance_status?: string;
    }> = [];

    if (lesson.teacher) {
      const teacherUser = lesson.teacher.userId
        ? userById.get(lesson.teacher.userId)
        : null;
      participants.push({
        role: 'teacher',
        user_id: lesson.teacher.userId || null,
        email: teacherUser?.email || lesson.teacher.email || null,
        name:
          lesson.teacher.name?.trim() ||
          composeDisplayName(
            lesson.teacher.firstName,
            lesson.teacher.lastName,
            'Преподаватель',
          ),
      });
    }

    if (lesson.tutor) {
      const tutorUser = lesson.tutor.userId
        ? userById.get(lesson.tutor.userId)
        : null;
      participants.push({
        role: 'tutor',
        user_id: lesson.tutor.userId || null,
        email: tutorUser?.email || lesson.tutor.email || null,
        name: lesson.tutor.displayName?.trim() || 'Репетитор',
      });
    }

    for (const row of rows) {
      if (!row.studentId) continue;
      const student = byId.get(row.studentId);
      const studentUser = student?.userId
        ? userById.get(student.userId)
        : null;
      participants.push({
        role: 'student',
        user_id: student?.userId || null,
        email: studentUser?.email || student?.email || null,
        student_id: row.studentId,
        attendance_id: row.id,
        attendance_status: row.attendanceStatus,
        name:
          student?.name?.trim() ||
          composeDisplayName(student?.firstName, student?.lastName, 'Ученик'),
      });
    }

    if (rows.length === 0 && lesson.primaryStudent) {
      const studentUser = lesson.primaryStudent.userId
        ? userById.get(lesson.primaryStudent.userId)
        : null;
      participants.push({
        role: 'student',
        user_id: lesson.primaryStudent.userId || null,
        email: studentUser?.email || lesson.primaryStudent.email || null,
        student_id: lesson.primaryStudent.id,
        name:
          lesson.primaryStudent.name?.trim() ||
          composeDisplayName(
            lesson.primaryStudent.firstName,
            lesson.primaryStudent.lastName,
            'Ученик',
          ),
      });
    }

    return { lesson_id: lessonId, participants };
  }

  /**
   * Find-or-create an internal lesson chat (kind=lesson, lesson_id set).
   * Never appears in the global «Чаты» messenger.
   */
  async ensureLessonChat(actor: JwtPayload, lessonId: string): Promise<ChatEntity> {
    await this.lessonAccess.assertCanReadLesson(actor, lessonId);
    const lesson = await this.lessons.findOne({
      where: { id: lessonId },
      relations: ['teacher', 'primaryStudent'],
    });
    if (!lesson) throw new NotFoundException('Урок не найден');

    let chat = await this.chats.findOne({ where: { lessonId } });
    if (!chat) {
      // Recover legacy rows created before lesson_id was persisted.
      chat = await this.chats.findOne({
        where: { description: `Чат урока ${lessonId}` },
      });
      if (chat) {
        await this.chats.update(chat.id, {
          lessonId,
          kind: ChatKind.Lesson,
          title: `Урок: ${this.resolveLessonTitle(lesson)}`,
        });
        chat = await this.chats.findOneOrFail({ where: { id: chat.id } });
      }
    }

    if (chat) {
      if (chat.kind !== ChatKind.Lesson || chat.lessonId !== lessonId) {
        await this.chats.update(chat.id, {
          lessonId,
          kind: ChatKind.Lesson,
        });
        chat = await this.chats.findOneOrFail({ where: { id: chat.id } });
      }
      await this.ensureChatMember(chat.id, actor.sub, ChatMemberRole.Member);
      return chat;
    }

    const title = `Урок: ${this.resolveLessonTitle(lesson)}`;
    const insertResult = await this.chats
      .createQueryBuilder()
      .insert()
      .into(ChatEntity)
      .values({
        kind: ChatKind.Lesson,
        title,
        description: `Чат урока ${lessonId}`,
        status: ChatStatus.Active,
        createdByUserId: actor.sub,
        subjectId: null,
        courseTemplateId: null,
        lessonId,
      })
      .returning('*')
      .execute();

    const insertedId = String(
      insertResult.identifiers?.[0]?.id ||
        insertResult.generatedMaps?.[0]?.id ||
        '',
    );
    chat = insertedId
      ? await this.chats.findOne({ where: { id: insertedId } })
      : await this.chats.findOne({ where: { lessonId } });
    if (!chat) {
      throw new NotFoundException('Не удалось создать чат урока');
    }
    if (!chat.lessonId || chat.kind !== ChatKind.Lesson) {
      await this.chats.update(chat.id, {
        lessonId,
        kind: ChatKind.Lesson,
      });
      chat = await this.chats.findOneOrFail({ where: { id: chat.id } });
    }

    const memberUserIds = new Set<string>([actor.sub]);
    if (lesson.teacher?.userId) memberUserIds.add(lesson.teacher.userId);
    if (lesson.primaryStudent?.userId) {
      memberUserIds.add(lesson.primaryStudent.userId);
    }
    const attendanceRows = await this.attendance.find({ where: { lessonId } });
    const studentIds = attendanceRows
      .map((r) => r.studentId)
      .filter((id): id is string => Boolean(id));
    if (studentIds.length) {
      const students = await this.students.find({ where: { id: In(studentIds) } });
      for (const s of students) {
        if (s.userId) memberUserIds.add(s.userId);
      }
    }

    for (const userId of memberUserIds) {
      const role =
        userId === actor.sub || userId === lesson.teacher?.userId
          ? ChatMemberRole.Owner
          : ChatMemberRole.Member;
      await this.ensureChatMember(chat.id, userId, role);
    }

    return chat;
  }

  private async ensureChatMember(
    chatId: string,
    userId: string,
    role: ChatMemberRole,
  ): Promise<void> {
    const existing = await this.chatMembers.findOne({
      where: { chatId, userId },
    });
    if (existing) {
      if (existing.hiddenAt) {
        existing.hiddenAt = null;
        await this.chatMembers.save(existing);
      }
      return;
    }
    await this.chatMembers.save(
      this.chatMembers.create({
        chatId,
        userId,
        role,
        hiddenAt: null,
      }),
    );
  }

  /**
   * Keep video_room_url aligned with current JITSI_BASE_URL.
   * Old rows pointing at meet.jit.si are rewritten on access.
   */
  private async syncLessonVideoUrl(lesson: LessonEntity): Promise<LessonEntity> {
    if (!lesson.videoRoomId) return lesson;
    const freshUrl = this.provider.getRoomUrl(lesson.videoRoomId);
    if (lesson.videoRoomUrl === freshUrl && lesson.videoProvider === 'jitsi') {
      return lesson;
    }
    lesson.videoProvider = 'jitsi';
    lesson.videoRoomUrl = freshUrl;
    if (!lesson.meetingLink || /jit\.si|8x8\.vc/i.test(lesson.meetingLink)) {
      lesson.meetingLink = this.buildCrmJoinUrl(lesson.id);
    }
    return this.lessons.save(lesson);
  }

  private roleLabelRu(
    role: 'admin' | 'teacher' | 'tutor' | 'student' | 'guest',
  ): string {
    if (role === 'admin') return 'администратор';
    if (role === 'teacher') return 'преподаватель';
    if (role === 'tutor') return 'тьютор';
    if (role === 'student') return 'ученик';
    return 'участник';
  }

  private resolveViewerRole(
    role: string | undefined,
  ): 'admin' | 'teacher' | 'tutor' | 'student' | 'guest' {
    const r = String(role || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (r === 'teacher') return 'teacher';
    if (r === 'tutor') return 'tutor';
    if (r === 'student' || r === 'tutor_student') return 'student';
    return 'guest';
  }

  /**
   * Jitsi moderator only for admin or the teacher/tutor who owns THIS lesson.
   * Assigned students always get participant.
   */
  private async resolveIsLessonHost(
    actor: JwtPayload,
    lesson: LessonEntity,
  ): Promise<boolean> {
    const role = String(actor.role || '').toLowerCase();
    if (role === 'admin') return true;
    if (role === 'teacher') {
      const teacher = await this.teachers.findOne({ where: { userId: actor.sub } });
      return Boolean(teacher?.id && lesson.teacherId === teacher.id);
    }
    if (role === 'tutor') {
      const tutor = await this.tutors.findOne({ where: { userId: actor.sub } });
      return Boolean(tutor?.id && lesson.tutorId === tutor.id);
    }
    return false;
  }

  private resolveLessonTitle(lesson: LessonEntity): string {
    const groupName = lesson.group?.name?.trim();
    if (groupName) return groupName;
    const notes = lesson.notes?.trim();
    if (notes) {
      const firstLine = notes.split(/\r?\n/)[0]?.trim();
      if (firstLine) return firstLine.slice(0, 120);
    }
    return 'Онлайн-урок';
  }

  private formatClock(time: string | null | undefined): string {
    return String(time || '00:00').slice(0, 5);
  }

  private formatEndClock(startTime: string, durationMin: number): string {
    const [hh, mm] = this.formatClock(startTime).split(':').map(Number);
    const total = (hh || 0) * 60 + (mm || 0) + durationMin;
    const endH = Math.floor(total / 60) % 24;
    const endM = total % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
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
    const now = this.getTimezoneNow().getTime();
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

  /**
   * Lesson date + start_time are school wall-clock values (Europe/Minsk by default).
   * Build a Date in the server's local calendar matching that wall clock, then
   * compare against getTimezoneNow() the same way as lesson schedulers.
   */
  private getLessonStart(lesson: LessonEntity): Date {
    const [year, month, day] = String(lesson.date || '').split('-').map(Number);
    const [hours, minutes] = String(lesson.startTime || '00:00')
      .split(':')
      .map(Number);
    return new Date(year, month - 1, day, hours, minutes || 0);
  }

  private getTimezoneNow(): Date {
    const tz =
      this.config.get<string>('jobs.reminderTimezone') ||
      process.env.REMINDER_TIMEZONE ||
      'Europe/Minsk';
    const now = new Date();
    const localized = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const offsetMs = localized.getTime() - now.getTime();
    return new Date(now.getTime() + offsetMs);
  }

  private async resolveDisplayName(
    actor: JwtPayload,
    user?: UserEntity | null,
  ): Promise<string> {
    const row = user ?? (await this.users.findOne({ where: { id: actor.sub } }));
    if (row) {
      const composed = composeDisplayName(row.firstName, row.lastName, row.email);
      if (composed) return composed;
    }
    if (actor.role === 'teacher' || actor.role === 'tutor') {
      const teacher = await this.teachers.findOne({ where: { userId: actor.sub } });
      if (teacher?.name?.trim()) return teacher.name.trim();
    }
    if (actor.role === 'student' || actor.role === 'tutor_student') {
      const student = await this.students.findOne({ where: { userId: actor.sub } });
      if (student?.name?.trim()) return student.name.trim();
    }
    return actor.email || 'Участник';
  }
}
