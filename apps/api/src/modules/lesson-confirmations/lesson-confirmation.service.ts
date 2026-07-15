import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupEntity } from '../groups/entities/group.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { AvailabilityBookingEntity } from '../schedule/entities/availability-booking.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import {
  build3hConfirmationMessage,
  buildTeacherLessonCancelledMessage,
  buildTeacherLessonConfirmedMessage,
  confirmationInlineKeyboard,
  formatLessonTime,
  resolveCourseTitle,
  TELEGRAM_MSG,
} from '../telegram/telegram-messages';
import { TelegramGateway } from '../telegram/telegram.gateway';
import { UserEntity } from '../users/entities/user.entity';
import {
  LessonConfirmationEntity,
  LessonConfirmationStatus,
} from './entities/lesson-confirmation.entity';

@Injectable()
export class LessonConfirmationService {
  private readonly logger = new Logger(LessonConfirmationService.name);

  constructor(
    @InjectRepository(LessonConfirmationEntity)
    private readonly confirmationRepo: Repository<LessonConfirmationEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepo: Repository<AttendanceEntity>,
    @InjectRepository(AvailabilityBookingEntity)
    private readonly bookingRepo: Repository<AvailabilityBookingEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(GroupMemberEntity)
    private readonly groupMemberRepo: Repository<GroupMemberEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly gateway: TelegramGateway,
  ) {}

  async findConfirmationById(
    id: string,
  ): Promise<LessonConfirmationEntity | null> {
    return this.confirmationRepo.findOne({ where: { id } });
  }

  async findByLessonAndStudent(
    lessonId: string,
    studentId: string,
  ): Promise<LessonConfirmationEntity | null> {
    return this.confirmationRepo.findOne({ where: { lessonId, studentId } });
  }

  /**
   * Confirmation flow is only for individual lessons.
   */
  isIndividualLesson(lesson: LessonEntity): boolean {
    return lesson.lessonType === 'individual' && !lesson.groupId;
  }

  async resolveParticipantStudentIds(lesson: LessonEntity): Promise<string[]> {
    if (this.isIndividualLesson(lesson) && lesson.primaryStudentId) {
      return [lesson.primaryStudentId];
    }

    const attendance = await this.attendanceRepo.find({
      where: { lessonId: lesson.id },
      select: ['studentId'],
    });
    if (attendance.length > 0) {
      return [
        ...new Set(
          attendance
            .map((row) => row.studentId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
    }

    if (lesson.groupId) {
      const members = await this.groupMemberRepo.find({
        where: { groupId: lesson.groupId },
        select: ['studentId'],
      });
      return [...new Set(members.map((row) => row.studentId))];
    }

    if (lesson.primaryStudentId) {
      return [lesson.primaryStudentId];
    }

    return [];
  }

  async assertStudentIsParticipant(
    lessonId: string,
    studentId: string,
  ): Promise<LessonEntity> {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson || lesson.status === 'cancelled') {
      throw new NotFoundException('Занятие не найдено');
    }
    const participantIds = await this.resolveParticipantStudentIds(lesson);
    if (!participantIds.includes(studentId)) {
      throw new BadRequestException('Вы не являетесь участником этого занятия');
    }
    return lesson;
  }

  async resolveLessonCourseTitle(lesson: LessonEntity): Promise<string> {
    let groupName: string | null = null;
    if (lesson.groupId) {
      const group = await this.groupRepo.findOne({ where: { id: lesson.groupId } });
      groupName = group?.name ?? null;
    }
    return resolveCourseTitle({
      groupName,
      lessonType: lesson.lessonType,
    });
  }

  /**
   * Create PENDING confirmation (if missing) and send Telegram request.
   * Individual lessons only. Returns null when student has no telegram, group lesson, or already has a row.
   */
  async requestConfirmationForStudent(
    lesson: LessonEntity,
    studentId: string,
  ): Promise<LessonConfirmationEntity | null> {
    if (!this.isIndividualLesson(lesson)) {
      return null;
    }

    const existing = await this.findByLessonAndStudent(lesson.id, studentId);
    if (existing) {
      return null;
    }

    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) {
      this.logger.warn(`Skip confirmation: student ${studentId} not found`);
      return null;
    }

    const chatId = await this.resolveStudentChatId(student);
    if (!chatId) {
      this.logger.warn(
        `Skip confirmation: student ${studentId} has no telegram_id`,
      );
      return null;
    }

    if (student.userId) {
      const linkedUser = await this.userRepo.findOne({
        where: { id: student.userId },
      });
      if (linkedUser && linkedUser.telegramNotify3h === false) {
        this.logger.warn(
          `Skip confirmation: student ${studentId} disabled 3h notifications`,
        );
        return null;
      }
    }

    const confirmation = await this.confirmationRepo.save(
      this.confirmationRepo.create({
        lessonId: lesson.id,
        studentId,
        telegramChatId: chatId,
        status: LessonConfirmationStatus.PENDING,
        requestedAt: null,
        confirmedAt: null,
        declinedAt: null,
        declineReason: null,
      }),
    );

    const sent = await this.sendConfirmationMessage(confirmation, lesson, student);
    if (!sent) {
      await this.confirmationRepo.delete({ id: confirmation.id });
      return null;
    }

    confirmation.requestedAt = new Date();
    return this.confirmationRepo.save(confirmation);
  }

  async sendConfirmationMessage(
    confirmation: LessonConfirmationEntity,
    lesson?: LessonEntity | null,
    student?: StudentEntity | null,
  ): Promise<boolean> {
    const resolvedLesson =
      lesson ??
      (await this.lessonRepo.findOne({ where: { id: confirmation.lessonId } }));
    const resolvedStudent =
      student ??
      (await this.studentRepo.findOne({ where: { id: confirmation.studentId } }));

    if (!resolvedLesson || !this.isIndividualLesson(resolvedLesson)) {
      return false;
    }

    const chatId = (
      confirmation.telegramChatId
      || (resolvedStudent ? await this.resolveStudentChatId(resolvedStudent) : null)
      || ''
    ).trim();
    if (!chatId) {
      return false;
    }

    const teacher = resolvedLesson.teacherId
      ? await this.teacherRepo.findOne({ where: { id: resolvedLesson.teacherId } })
      : null;

    const text = build3hConfirmationMessage({
      teacher: teacher?.name?.trim() || '—',
      date: resolvedLesson.date || '—',
      time: formatLessonTime(resolvedLesson.startTime),
    });

    const result = await this.gateway.sendMessage(chatId, text, {
      replyMarkup: confirmationInlineKeyboard(confirmation.id),
    });

    if (!result.ok) {
      this.logger.error(
        `Failed to send confirmation ${confirmation.id}: ${result.error ?? result.description}`,
      );
      return false;
    }
    return true;
  }

  async confirm(confirmationId: string, chatId: string): Promise<LessonConfirmationEntity> {
    const confirmation = await this.requirePendingConfirmation(confirmationId, chatId);
    confirmation.status = LessonConfirmationStatus.CONFIRMED;
    confirmation.confirmedAt = new Date();
    confirmation.declinedAt = null;
    confirmation.declineReason = null;
    confirmation.telegramChatId = chatId;
    await this.confirmationRepo.save(confirmation);
    // Lesson stays planned — confirmation is recorded on lesson_confirmations.
    await this.notifyTeacher(confirmation, 'confirmed');
    return confirmation;
  }

  async decline(confirmationId: string, chatId: string): Promise<LessonConfirmationEntity> {
    const confirmation = await this.requirePendingConfirmation(confirmationId, chatId);
    confirmation.status = LessonConfirmationStatus.DECLINED;
    confirmation.declinedAt = new Date();
    confirmation.declineReason = null;
    confirmation.confirmedAt = null;
    confirmation.telegramChatId = chatId;
    await this.confirmationRepo.save(confirmation);

    const lesson = await this.lessonRepo.findOne({ where: { id: confirmation.lessonId } });
    if (lesson && lesson.status === 'planned' && this.isIndividualLesson(lesson)) {
      lesson.status = 'cancelled';
      await this.lessonRepo.save(lesson);
      await this.bookingRepo.update(
        { lessonId: lesson.id },
        { status: 'cancelled' },
      );
      await this.attendanceRepo.update(
        { lessonId: lesson.id },
        { attendanceStatus: 'cancelled' },
      );
    }

    await this.notifyTeacher(confirmation, 'declined');
    return confirmation;
  }

  /**
   * Admin/manual: send confirmation for a student + lesson (creates row if needed).
   */
  async sendTestConfirmation(
    studentId: string,
    lessonId?: string,
  ): Promise<LessonConfirmationEntity> {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Ученик не найден');
    }
    const chatId = await this.resolveStudentChatId(student);
    if (!chatId) {
      throw new BadRequestException('У пользователя не подключен Telegram');
    }

    let lesson: LessonEntity | null = null;
    if (lessonId) {
      lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
      if (!lesson) {
        throw new NotFoundException('Занятие не найдено');
      }
    } else {
      lesson = await this.findNearestUpcomingLessonForStudent(studentId);
      if (!lesson) {
        throw new NotFoundException('Нет предстоящих занятий для ученика');
      }
    }

    await this.assertStudentIsParticipant(lesson.id, studentId);

    if (!this.isIndividualLesson(lesson)) {
      throw new BadRequestException(
        'Подтверждение доступно только для индивидуальных занятий',
      );
    }

    const existing = await this.findByLessonAndStudent(lesson.id, studentId);
    if (existing) {
      const ok = await this.sendConfirmationMessage(existing, lesson, student);
      if (!ok) {
        throw new BadRequestException('Не удалось отправить сообщение в Telegram');
      }
      if (!existing.requestedAt) {
        existing.requestedAt = new Date();
        await this.confirmationRepo.save(existing);
      }
      return existing;
    }

    const created = await this.requestConfirmationForStudent(lesson, studentId);
    if (!created) {
      throw new BadRequestException('Не удалось создать и отправить подтверждение');
    }
    return created;
  }

  private async findNearestUpcomingLessonForStudent(
    studentId: string,
  ): Promise<LessonEntity | null> {
    const planned = await this.lessonRepo.find({
      where: { status: 'planned' },
      order: { date: 'ASC', startTime: 'ASC' },
      take: 200,
    });
    const now = Date.now();
    for (const lesson of planned) {
      const start = this.getLessonStartMs(lesson);
      if (start < now) continue;
      const participants = await this.resolveParticipantStudentIds(lesson);
      if (participants.includes(studentId)) {
        return lesson;
      }
    }
    return null;
  }

  private getLessonStartMs(lesson: LessonEntity): number {
    const [year, month, day] = String(lesson.date || '').split('-').map(Number);
    const [hours, minutes] = String(lesson.startTime || '00:00').split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes).getTime();
  }

  private async requirePendingConfirmation(
    confirmationId: string,
    chatId: string,
  ): Promise<LessonConfirmationEntity> {
    const confirmation = await this.confirmationRepo.findOne({
      where: { id: confirmationId },
    });
    if (!confirmation) {
      throw new NotFoundException(TELEGRAM_MSG.staleButton);
    }
    if (confirmation.status === LessonConfirmationStatus.CONFIRMED) {
      throw new BadRequestException(TELEGRAM_MSG.alreadyConfirmed);
    }
    if (confirmation.status === LessonConfirmationStatus.DECLINED) {
      throw new BadRequestException(TELEGRAM_MSG.alreadyDeclined);
    }
    if (confirmation.status !== LessonConfirmationStatus.PENDING) {
      throw new BadRequestException(TELEGRAM_MSG.staleButton);
    }

    const student = await this.studentRepo.findOne({
      where: { id: confirmation.studentId },
    });
    const expectedChat = (
      confirmation.telegramChatId
      || (student ? await this.resolveStudentChatId(student) : null)
      || ''
    ).trim();
    if (!expectedChat) {
      this.logger.warn(
        `Confirmation ${confirmationId}: no telegram_id for student ${confirmation.studentId}`,
      );
      throw new BadRequestException(TELEGRAM_MSG.notLinkedShort);
    }
    if (expectedChat !== chatId) {
      this.logger.warn(
        `Confirmation ${confirmationId}: chat mismatch expected=${expectedChat} got=${chatId}`,
      );
      throw new BadRequestException(TELEGRAM_MSG.staleButton);
    }

    await this.assertStudentIsParticipant(
      confirmation.lessonId,
      confirmation.studentId,
    );
    const lesson = await this.lessonRepo.findOne({
      where: { id: confirmation.lessonId },
    });
    if (!lesson || !this.isIndividualLesson(lesson)) {
      throw new BadRequestException(
        'Подтверждение доступно только для индивидуальных занятий',
      );
    }
    return confirmation;
  }

  async resolveStudentTelegramChatId(studentId: string): Promise<string | null> {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) return null;
    return this.resolveStudentChatId(student);
  }

  async isNotifyEnabledForStudent(
    studentId: string,
    kind: '24h' | '3h',
  ): Promise<boolean> {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student?.userId) {
      return true;
    }
    const user = await this.userRepo.findOne({ where: { id: student.userId } });
    if (!user) {
      return true;
    }
    return kind === '24h'
      ? user.telegramNotify24h !== false
      : user.telegramNotify3h !== false;
  }

  /**
   * Source of truth: User.telegram_id when the student has a linked user.
   * Never prefer a stale Student.telegram_id over an empty User.telegram_id.
   */
  private async resolveStudentChatId(
    student: StudentEntity,
  ): Promise<string | null> {
    if (student.userId) {
      const user = await this.userRepo.findOne({ where: { id: student.userId } });
      if (!user) {
        return null;
      }
      const userTg = (user.telegramId ?? '').trim();
      const nextId = userTg || null;
      const nextUsername = userTg ? (user.telegramUsername ?? null) : null;
      const nextConnectedAt = userTg ? (user.telegramConnectedAt ?? null) : null;
      if (
        (student.telegramId ?? null) !== nextId
        || (student.telegramUsername ?? null) !== nextUsername
        || (student.telegramConnectedAt?.getTime() ?? null)
          !== (nextConnectedAt?.getTime() ?? null)
      ) {
        student.telegramId = nextId;
        student.telegramUsername = nextUsername;
        student.telegramConnectedAt = nextConnectedAt;
        await this.studentRepo.save(student);
      }
      return userTg || null;
    }
    const profileTg = (student.telegramId ?? '').trim();
    return profileTg || null;
  }

  private async notifyTeacher(
    confirmation: LessonConfirmationEntity,
    status: 'confirmed' | 'declined',
  ): Promise<void> {
    const [student, lesson] = await Promise.all([
      this.studentRepo.findOne({ where: { id: confirmation.studentId } }),
      this.lessonRepo.findOne({ where: { id: confirmation.lessonId } }),
    ]);
    if (!lesson?.teacherId) {
      return;
    }

    const teacherChat = await this.resolveTeacherChatId(lesson.teacherId);
    if (!teacherChat) {
      this.logger.warn(
        `Skip teacher notify: teacher ${lesson.teacherId} has no telegram`,
      );
      return;
    }

    const payload = {
      student: student?.name?.trim() || 'Ученик',
      date: lesson.date || '—',
      time: formatLessonTime(lesson.startTime),
    };
    const text =
      status === 'confirmed'
        ? buildTeacherLessonConfirmedMessage(payload)
        : buildTeacherLessonCancelledMessage(payload);

    await this.gateway.sendMessage(teacherChat, text).catch((error) => {
      this.logger.warn(
        `Teacher notify failed for ${lesson.teacherId}: ${(error as Error).message}`,
      );
    });
  }

  private async resolveTeacherChatId(teacherId: string): Promise<string | null> {
    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (!teacher) {
      return null;
    }
    const profileTg = (teacher.telegramId ?? '').trim();
    if (profileTg) {
      return profileTg;
    }
    if (!teacher.userId) {
      return null;
    }
    const user = await this.userRepo.findOne({ where: { id: teacher.userId } });
    return (user?.telegramId ?? '').trim() || null;
  }
}
