import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In } from 'typeorm';
import { LessonAccessService } from '../../common/access/lesson-access.service';
import { TeacherAccessService } from '../../common/access/teacher-access.service';
import { TutorAccessService } from '../../common/access/tutor-access.service';
import { normalizeRole } from '../../common/constants/roles';
import { JwtPayload } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { EnrollmentProgressService } from '../courses/enrollment-progress.service';
import { GroupEntity } from '../groups/entities/group.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { LessonConfirmationService } from '../lesson-confirmations/lesson-confirmation.service';
import { AvailabilityBookingEntity } from '../schedule/entities/availability-booking.entity';
import { ScheduleService } from '../schedule/schedule.service';
import { StudentEntity } from '../students/entities/student.entity';
import { StudentBalanceService } from '../students/student-balance.service';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TeacherPaymentsService } from '../teacher-payments/teacher-payments.service';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../tutors/entities/tutor-student.entity';
import { AttendanceEntity } from './entities/attendance.entity';
import {
  isScheduleOccupyingLessonStatus,
  LessonEntity,
} from './entities/lesson.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import {
  LESSON_RESCHEDULED,
  LESSON_UPDATED,
  LessonRescheduledPayload,
  LessonUpdatedChangedField,
  LessonUpdatedPayload,
} from './events/lesson.events';
import { formatStudentProfileDisplayName } from '../users/display-name.util';
import { LessonsRepository } from './lessons.repository';

/** Terminal lesson statuses a teacher cannot change again after confirming. */
const TEACHER_LOCKED_LESSON_STATUSES = new Set([
  'completed',
  'cancelled',
  'missed',
  'missed_no_notice',
  'rescheduled',
]);

/**
 * Statuses that already ran financial side-effects (balance + TeacherPayment).
 * Leaving these via PATCH/cancel without a compensating reverse would corrupt money state.
 * We forbid the transition rather than auto-mutating historical balances.
 */
const FINANCIALLY_FINALIZED_LESSON_STATUSES = new Set(['completed']);

/** Attendance statuses a teacher cannot overwrite after confirmation. */
const TEACHER_LOCKED_ATTENDANCE_STATUSES = new Set([
  'attended',
  'missed',
  'missed_no_notice',
  'cancelled',
]);

@Injectable()
export class LessonsService {
  constructor(
    private readonly repository: LessonsRepository,
    private readonly studentBalanceService: StudentBalanceService,
    private readonly lessonAccess: LessonAccessService,
    private readonly teacherAccess: TeacherAccessService,
    private readonly tutorAccess: TutorAccessService,
    private readonly scheduleService: ScheduleService,
    private readonly teacherPaymentsService: TeacherPaymentsService,
    private readonly enrollmentProgress: EnrollmentProgressService,
    private readonly lessonConfirmations: LessonConfirmationService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(actor: JwtPayload): Promise<LessonEntity[]> {
    const where = await this.lessonAccess.scopeLessonFilter(actor, {});
    const rows = await this.repository.filter(where as FindOptionsWhere<LessonEntity>);
    return this.attachDisplayNames(rows);
  }

  async findById(actor: JwtPayload, id: string): Promise<LessonEntity> {
    await this.lessonAccess.assertCanReadLesson(actor, id);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Lesson not found');
    }
    return (await this.attachDisplayNames([row]))[0];
  }

  /**
   * @param actor Authenticated user for HTTP create. Pass null for trusted internal callers
   *              (e.g. lesson-series generator already authorized at the series endpoint).
   */
  async create(actor: JwtPayload | null, dto: CreateLessonDto): Promise<LessonEntity> {
    const normalized = this.normalizeCreateLessonDto(dto);

    if (actor) {
      await this.assertCanCreateLesson(actor, normalized);
    }

    if (normalized.tutorId) {
      return this.createTutorLesson(normalized);
    }

    if (!normalized.teacherId) {
      throw new BadRequestException(
        'Укажите преподавателя (teacherId) или репетитора (tutorId)',
      );
    }

    const duration = normalized.duration ?? 60;
    const lessonType =
      normalized.lessonType ?? (normalized.groupId ? 'group' : 'individual');

    if (lessonType === 'group' && !normalized.groupId) {
      throw new BadRequestException('Выберите группу для группового урока');
    }
    if (lessonType === 'individual' && !normalized.primaryStudentId) {
      throw new BadRequestException('Выберите ученика для индивидуального урока');
    }
    if (!normalized.groupId && !normalized.primaryStudentId) {
      throw new BadRequestException(
        'Выберите ученика для индивидуального урока или группу для группового',
      );
    }

    await this.scheduleService.assertAvailableForLesson(
      normalized.teacherId,
      normalized.date,
      normalized.startTime,
      duration,
    );
    await this.scheduleService.assertNoScheduleConflicts(
      normalized.teacherId,
      normalized.date,
      normalized.startTime,
      duration,
    );

    const createStudentIds = await this.resolveCreateStudentIdsForConflict(normalized);
    await this.scheduleService.assertNoStudentScheduleConflicts(
      createStudentIds,
      normalized.date,
      normalized.startTime,
      duration,
    );

    const created = await this.dataSource.transaction(async (manager) => {
      const teacher = await manager.getRepository(TeacherEntity).findOne({
        where: { id: normalized.teacherId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!teacher) {
        throw new NotFoundException('Преподаватель не найден');
      }

      // Serialize overlapping creates for the same teacher/students, then re-check.
      await this.scheduleService.assertNoScheduleConflicts(
        normalized.teacherId as string,
        normalized.date,
        normalized.startTime,
        duration,
      );
      for (const studentId of createStudentIds) {
        await manager.getRepository(StudentEntity).findOne({
          where: { id: studentId },
          lock: { mode: 'pessimistic_write' },
        });
      }
      await this.scheduleService.assertNoStudentScheduleConflicts(
        createStudentIds,
        normalized.date,
        normalized.startTime,
        duration,
      );

      if (normalized.groupId) {
        const group = await manager.getRepository(GroupEntity).findOne({
          where: { id: normalized.groupId },
        });
        if (!group) {
          throw new NotFoundException('Группа не найдена');
        }
        if (group.teacherId !== normalized.teacherId) {
          throw new BadRequestException(
            'Группа не принадлежит выбранному преподавателю',
          );
        }
      }

      if (normalized.primaryStudentId && !normalized.groupId) {
        const student = await manager.getRepository(StudentEntity).findOne({
          where: { id: normalized.primaryStudentId },
        });
        if (!student) {
          throw new NotFoundException('Ученик не найден');
        }
      }

      const lessonRepo = manager.getRepository(LessonEntity);
      const lesson = await lessonRepo.save(
        lessonRepo.create({
          teacherId: normalized.teacherId as string,
          tutorId: null,
          seriesId: normalized.seriesId ?? null,
          groupId: normalized.groupId ?? null,
          primaryStudentId: normalized.groupId
            ? null
            : (normalized.primaryStudentId ?? null),
          date: normalized.date,
          startTime: normalized.startTime,
          duration,
          status: normalized.status ?? 'planned',
          lessonType,
          lessonFormat: normalized.lessonFormat ?? 'online',
          meetingLink: normalized.meetingLink ?? null,
          room: normalized.room ?? null,
          notes: normalized.notes ?? null,
        }),
      );

      const studentIds = await this.resolveLessonStudentIds(normalized, manager);
      const attendanceRepo = manager.getRepository(AttendanceEntity);
      for (const studentId of studentIds) {
        await attendanceRepo.save(
          attendanceRepo.create({
            lessonId: lesson.id,
            studentId,
            attendanceStatus: 'enrolled',
          }),
        );
      }

      const timeFrom = this.scheduleService.normalizeTime(normalized.startTime);
      const timeTo = this.scheduleService.addMinutesToTime(timeFrom, duration);
      await manager.getRepository(AvailabilityBookingEntity).save({
        teacherId: normalized.teacherId as string,
        lessonId: lesson.id,
        date: normalized.date,
        timeFrom,
        timeTo,
        status: 'active',
      });

      return lesson;
    });

    const withNames = await this.repository.findById(created.id);
    return (await this.attachDisplayNames([withNames ?? created]))[0];
  }

  /**
   * Tutor-owned individual lessons: no school availability slots, no teacher payroll.
   */
  private async createTutorLesson(dto: CreateLessonDto): Promise<LessonEntity> {
    const tutorId = dto.tutorId as string;
    const duration = dto.duration ?? 60;
    const lessonType = dto.lessonType ?? 'individual';
    const primaryTutorStudentId =
      dto.primaryTutorStudentId || dto.tutorStudentId || undefined;

    if (lessonType === 'group' || dto.groupId) {
      throw new BadRequestException(
        'Групповые занятия доступны только преподавателям школы',
      );
    }
    if (!primaryTutorStudentId) {
      throw new BadRequestException('Выберите ученика репетитора для индивидуального урока');
    }

    await this.scheduleService.assertNoTutorScheduleConflicts(
      tutorId,
      dto.date,
      dto.startTime,
      duration,
    );
    await this.scheduleService.assertNoTutorStudentScheduleConflicts(
      [primaryTutorStudentId],
      dto.date,
      dto.startTime,
      duration,
    );

    const created = await this.dataSource.transaction(async (manager) => {
      const tutor = await manager.getRepository(TutorEntity).findOne({
        where: { id: tutorId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tutor) {
        throw new NotFoundException('Репетитор не найден');
      }

      await this.scheduleService.assertNoTutorScheduleConflicts(
        tutorId,
        dto.date,
        dto.startTime,
        duration,
      );

      const tutorStudent = await manager.getRepository(TutorStudentEntity).findOne({
        where: { id: primaryTutorStudentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tutorStudent) {
        throw new NotFoundException('Ученик репетитора не найден');
      }
      if (tutorStudent.tutorId !== tutorId) {
        throw new BadRequestException(
          'Ученик не закреплён за этим репетитором',
        );
      }

      await this.scheduleService.assertNoTutorStudentScheduleConflicts(
        [primaryTutorStudentId],
        dto.date,
        dto.startTime,
        duration,
      );

      const lessonRepo = manager.getRepository(LessonEntity);
      const lesson = await lessonRepo.save(
        lessonRepo.create({
          teacherId: null,
          tutorId,
          seriesId: null,
          groupId: null,
          primaryStudentId: null,
          primaryTutorStudentId,
          date: dto.date,
          startTime: dto.startTime,
          duration,
          status: dto.status ?? 'planned',
          lessonType: 'individual',
          lessonFormat: dto.lessonFormat ?? 'online',
          meetingLink: dto.meetingLink ?? null,
          room: dto.room ?? null,
          notes: dto.notes ?? null,
        }),
      );

      await manager.getRepository(AttendanceEntity).save(
        manager.getRepository(AttendanceEntity).create({
          lessonId: lesson.id,
          studentId: null,
          tutorStudentId: primaryTutorStudentId,
          attendanceStatus: 'enrolled',
        }),
      );

      return lesson;
    });

    const withNames = await this.repository.findById(created.id);
    return (await this.attachDisplayNames([withNames ?? created]))[0];
  }

  private normalizeCreateLessonDto(dto: CreateLessonDto): CreateLessonDto {
    const primaryStudentId = dto.primaryStudentId || dto.studentId || undefined;
    const primaryTutorStudentId =
      dto.primaryTutorStudentId || dto.tutorStudentId || undefined;
    return {
      ...dto,
      primaryStudentId,
      primaryTutorStudentId,
      studentId: undefined,
      tutorStudentId: undefined,
      lessonType:
        dto.lessonType ??
        (dto.groupId
          ? 'group'
          : primaryStudentId || primaryTutorStudentId
            ? 'individual'
            : undefined),
    };
  }

  private async assertCanCreateLesson(
    actor: JwtPayload,
    dto: CreateLessonDto,
  ): Promise<void> {
    if (normalizeRole(actor.role) === 'admin') {
      return;
    }

    if (normalizeRole(actor.role) === 'teacher') {
      const teacherId = await this.teacherAccess.resolveTeacherId(actor);
      if (!teacherId || dto.teacherId !== teacherId || dto.tutorId) {
        throw new ForbiddenException('Можно создавать уроки только для себя');
      }
      return;
    }

    if (normalizeRole(actor.role) === 'tutor') {
      const tutorId = await this.tutorAccess.resolveTutorId(actor);
      if (!tutorId || dto.tutorId !== tutorId || dto.teacherId) {
        throw new ForbiddenException('Можно создавать уроки только для себя');
      }
      return;
    }

    throw new ForbiddenException('Forbidden');
  }

  async update(actor: JwtPayload, id: string, dto: UpdateLessonDto): Promise<LessonEntity> {
    const before = await this.repository.findById(id);
    if (!before) {
      throw new NotFoundException('Lesson not found');
    }

    const normalizedDto: UpdateLessonDto = {
      ...dto,
      primaryStudentId: dto.primaryStudentId || dto.studentId,
      studentId: undefined,
    };

    const payload = await this.lessonAccess.assertCanWriteLesson(
      actor,
      id,
      normalizedDto as Record<string, unknown>,
    );

    if (
      typeof payload.status === 'string' &&
      payload.status !== before.status &&
      FINANCIALLY_FINALIZED_LESSON_STATUSES.has(before.status)
    ) {
      throw new ConflictException(
        'Нельзя изменить статус завершённого занятия: баланс и начисления уже зафиксированы',
      );
    }

    // UI cancels via PATCH { status: 'cancelled' }. Route through cancel() so we
    // take the same pessimistic lock as cron completion and reject non-planned.
    if (
      typeof payload.status === 'string' &&
      payload.status === 'cancelled' &&
      before.status !== 'cancelled'
    ) {
      return this.cancel(actor, id);
    }

    const completing =
      payload.status &&
      typeof payload.status === 'string' &&
      payload.status === 'completed' &&
      before.status !== 'completed';

    const completionAttendance: 'attended' | 'missed' =
      payload.completionAttendance === 'missed' ? 'missed' : 'attended';

    if (
      normalizeRole(actor.role) === 'teacher' &&
      TEACHER_LOCKED_LESSON_STATUSES.has(before.status) &&
      typeof payload.status === 'string' &&
      payload.status !== before.status
    ) {
      throw new ForbiddenException(
        'Статус занятия уже зафиксирован и не может быть изменён',
      );
    }

    if (completing) {
      const completed = await this.finalizeLessonCompletion(id, {
        attendanceStatus: completionAttendance,
      });
      if (completed) {
        const withNames = await this.repository.findById(completed.id);
        return (await this.attachDisplayNames([withNames ?? completed]))[0];
      }
      throw new NotFoundException('Lesson not found');
    }

    const teacherId = (payload.teacherId as string | undefined) ?? before.teacherId;
    const tutorId = (payload.tutorId as string | undefined) ?? before.tutorId;
    const date = (payload.date as string | undefined) ?? before.date;
    const startTime = (payload.startTime as string | undefined) ?? before.startTime;
    const duration = (payload.duration as number | undefined) ?? before.duration ?? 60;
    const nextStatus = (payload.status as string | undefined) ?? before.status;

    const timeRescheduled =
      date !== before.date ||
      this.scheduleService.normalizeTime(startTime).slice(0, 5) !==
        this.scheduleService.normalizeTime(before.startTime).slice(0, 5) ||
      duration !== (before.duration ?? 60);

    const scheduleSlotChanged =
      timeRescheduled ||
      teacherId !== before.teacherId ||
      tutorId !== before.tutorId;

    const infoChanges = this.collectLessonInfoChanges(before, payload);

    if (
      scheduleSlotChanged &&
      before.status !== 'cancelled' &&
      nextStatus !== 'cancelled'
    ) {
      if (tutorId && !teacherId) {
        await this.scheduleService.assertNoTutorScheduleConflicts(
          tutorId,
          date,
          startTime,
          duration,
          id,
        );
      } else if (teacherId) {
        await this.scheduleService.assertAvailableForLesson(teacherId, date, startTime, duration);
        await this.scheduleService.assertNoScheduleConflicts(
          teacherId,
          date,
          startTime,
          duration,
          id,
        );
      }
    }

    if (
      timeRescheduled &&
      before.status !== 'cancelled' &&
      nextStatus !== 'cancelled'
    ) {
      const participantLesson = {
        ...before,
        primaryStudentId:
          (payload.primaryStudentId as string | undefined) ?? before.primaryStudentId,
        groupId: (payload.groupId as string | undefined) ?? before.groupId,
        lessonType:
          (payload.lessonType as LessonEntity['lessonType'] | undefined) ??
          before.lessonType,
      };
      const studentIds =
        await this.lessonConfirmations.resolveParticipantStudentIds(participantLesson);
      await this.scheduleService.assertNoStudentScheduleConflicts(
        studentIds,
        date,
        startTime,
        duration,
        id,
      );
    }

    const confirmedStudentIds = timeRescheduled
      ? await this.lessonConfirmations.findConfirmedStudentIdsForLesson(id)
      : [];

    if (timeRescheduled) {
      // Reminder jobs key off lesson.date/startTime + reminder24hSent.
      (payload as UpdateLessonDto & { reminder24hSent?: boolean }).reminder24hSent =
        false;
    }

    // completionAttendance is only a completion hint — not a lessons column.
    const { completionAttendance: _completionAttendance, ...lessonFields } =
      payload as UpdateLessonDto & { completionAttendance?: 'attended' | 'missed' };

    const row = await this.repository.update(id, lessonFields as UpdateLessonDto);
    if (!row) {
      throw new NotFoundException('Lesson not found');
    }

    const nextPrimaryStudentId =
      (payload.primaryStudentId as string | undefined) ?? before.primaryStudentId;
    const primaryReassigned =
      Boolean(nextPrimaryStudentId) &&
      nextPrimaryStudentId !== before.primaryStudentId &&
      !row.groupId &&
      (row.lessonType === 'individual' || !row.groupId);
    if (primaryReassigned && nextPrimaryStudentId) {
      await this.syncIndividualLessonAttendance(row.id, nextPrimaryStudentId);
    }

    // UI cancels via PATCH { status: 'cancelled' } (not /cancel). Always free the booking
    // when the lesson leaves an occupying status, even if date/time did not change.
    const statusReleasedSlot =
      typeof payload.status === 'string' &&
      payload.status !== before.status &&
      !isScheduleOccupyingLessonStatus(payload.status);

    if (statusReleasedSlot) {
      await this.dataSource.getRepository(AvailabilityBookingEntity).update(
        { lessonId: id },
        { status: 'cancelled' },
      );
    } else if (scheduleSlotChanged && teacherId && !tutorId) {
      const timeFrom = this.scheduleService.normalizeTime(startTime);
      const timeTo = this.scheduleService.addMinutesToTime(timeFrom, duration);
      const bookingUpdate: Partial<AvailabilityBookingEntity> = {
        date,
        timeFrom,
        timeTo,
        status: isScheduleOccupyingLessonStatus(nextStatus) ? 'active' : 'cancelled',
      };
      if (teacherId) {
        bookingUpdate.teacherId = teacherId;
      }
      await this.dataSource.getRepository(AvailabilityBookingEntity).update(
        { lessonId: id },
        bookingUpdate,
      );
    }

    let teacherName: string | null = null;
    const resolvedTeacherId = teacherId ?? before.teacherId;
    if (resolvedTeacherId && (timeRescheduled || infoChanges.length > 0)) {
      teacherName =
        (
          await this.dataSource.getRepository(TeacherEntity).findOne({
            where: { id: resolvedTeacherId },
            select: ['id', 'name'],
          })
        )?.name?.trim() || null;
    }
    const actorLabel = teacherName || actor.email || 'Преподаватель';

    if (timeRescheduled) {
      if (confirmedStudentIds.length > 0) {
        await this.lessonConfirmations.resetConfirmedAndRerequest(
          row,
          confirmedStudentIds,
        );
      }

      await this.audit.log({
        actorUserId: actor.sub,
        action: 'lesson_rescheduled',
        entityType: 'Lesson',
        entityId: id,
        summary: [
          `Преподаватель ${actorLabel} перенёс занятие.`,
          `Было: ${before.date} ${this.scheduleService.normalizeTime(before.startTime).slice(0, 5)} (${before.duration ?? 60} мин)`,
          `Стало: ${date} ${this.scheduleService.normalizeTime(startTime).slice(0, 5)} (${duration} мин)`,
        ].join(' '),
      });

      if (confirmedStudentIds.length > 0) {
        const eventPayload: LessonRescheduledPayload = {
          lessonId: id,
          teacherId: resolvedTeacherId,
          actorUserId: actor.sub,
          teacherDisplayName: teacherName ?? actorLabel,
          previous: {
            date: before.date,
            startTime: before.startTime,
            duration: before.duration ?? 60,
          },
          next: {
            date,
            startTime,
            duration,
          },
          confirmedStudentIds,
        };
        this.events.emit(LESSON_RESCHEDULED, eventPayload);
      }
    } else if (infoChanges.length > 0) {
      const studentIds = await this.lessonConfirmations.resolveParticipantStudentIds(row);

      await this.audit.log({
        actorUserId: actor.sub,
        action: 'lesson_updated',
        entityType: 'Lesson',
        entityId: id,
        summary: [
          `Преподаватель ${actorLabel} обновил информацию о занятии.`,
          ...infoChanges.map(
            (change) =>
              `${change.label}: «${change.previous ?? '—'}» → «${change.next ?? '—'}»`,
          ),
        ].join(' '),
      });

      this.events.emit(LESSON_UPDATED, {
        lessonId: id,
        teacherId: resolvedTeacherId,
        actorUserId: actor.sub,
        teacherDisplayName: teacherName ?? actorLabel,
        changedFields: infoChanges,
        studentIds,
      } satisfies LessonUpdatedPayload);
    }

    if (
      payload.status &&
      typeof payload.status === 'string' &&
      payload.status !== before.status
    ) {
      await this.studentBalanceService.handleLessonStatusUpdate(id, payload.status);
    }
    return (await this.attachDisplayNames([row]))[0];
  }

  private collectLessonInfoChanges(
    before: LessonEntity,
    payload: Record<string, unknown>,
  ): LessonUpdatedChangedField[] {
    const changes: LessonUpdatedChangedField[] = [];
    const normalize = (value: unknown): string | null => {
      if (value == null) return null;
      const text = String(value).trim();
      return text.length ? text : null;
    };

    if (payload.notes !== undefined) {
      const previous = normalize(before.notes);
      const next = normalize(payload.notes);
      if (previous !== next) {
        changes.push({
          field: 'notes',
          label: 'комментарий',
          previous,
          next,
        });
      }
    }

    if (payload.meetingLink !== undefined) {
      const previous = normalize(before.meetingLink);
      const next = normalize(payload.meetingLink);
      if (previous !== next) {
        changes.push({
          field: 'meetingLink',
          label: 'ссылка',
          previous,
          next,
        });
      }
    }

    if (payload.room !== undefined) {
      const previous = normalize(before.room);
      const next = normalize(payload.room);
      if (previous !== next) {
        changes.push({
          field: 'room',
          label: 'кабинет',
          previous,
          next,
        });
      }
    }

    return changes;
  }

  private async resolveCreateStudentIdsForConflict(
    dto: CreateLessonDto,
  ): Promise<string[]> {
    if (dto.primaryStudentId && !dto.groupId) {
      return [dto.primaryStudentId];
    }
    if (dto.groupId) {
      const members = await this.dataSource.getRepository(GroupMemberEntity).find({
        where: { groupId: dto.groupId },
        select: ['studentId'],
      });
      return [...new Set(members.map((row) => row.studentId).filter(Boolean))];
    }
    return [];
  }

  async delete(id: string): Promise<void> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Lesson not found');
    }
    await this.repository.delete(id);
  }

  async filter(actor: JwtPayload, where: Record<string, unknown>): Promise<LessonEntity[]> {
    const normalized = this.normalizeLessonFilterWhere(where);
    const scoped = await this.lessonAccess.scopeLessonFilter(actor, normalized);
    const rows = await this.repository.filter(scoped as FindOptionsWhere<LessonEntity>);
    return this.attachDisplayNames(rows);
  }

  /** Map legacy student_id filters onto primary_student_id for lessons. */
  private normalizeLessonFilterWhere(
    where: Record<string, unknown>,
  ): Record<string, unknown> {
    const next = { ...where };
    if (next.student_id != null && next.primary_student_id == null) {
      next.primary_student_id = next.student_id;
      delete next.student_id;
    }
    if (next.studentId != null && next.primaryStudentId == null) {
      next.primaryStudentId = next.studentId;
      delete next.studentId;
    }
    return next;
  }

  /**
   * Attach teacher/student display fields for FE.
   * student_ids / student_names come from attendance (LessonStudent link),
   * with individual primaryStudent as fallback when attendance is empty.
   */
  private async attachDisplayNames(lessons: LessonEntity[]): Promise<LessonEntity[]> {
    if (lessons.length === 0) {
      return lessons;
    }

    const lessonIds = lessons.map((lesson) => lesson.id);
    const attendanceRows = await this.dataSource.getRepository(AttendanceEntity).find({
      where: { lessonId: In(lessonIds) },
    });

    const studentIdsByLesson = new Map<string, string[]>();
    for (const row of attendanceRows) {
      if (!row.studentId) continue;
      const list = studentIdsByLesson.get(row.lessonId) ?? [];
      if (!list.includes(row.studentId)) {
        list.push(row.studentId);
      }
      studentIdsByLesson.set(row.lessonId, list);
    }

    const allStudentIds = [
      ...new Set([
        ...attendanceRows.map((row) => row.studentId).filter((id): id is string => Boolean(id)),
        ...lessons
          .map((lesson) => lesson.primaryStudentId)
          .filter((id): id is string => Boolean(id)),
      ]),
    ];
    const students =
      allStudentIds.length > 0
        ? await this.dataSource.getRepository(StudentEntity).find({
            where: { id: In(allStudentIds) },
            select: ['id', 'name', 'firstName', 'lastName'],
          })
        : [];
    const studentNameById = new Map(
      students.map((student) => {
        const label = formatStudentProfileDisplayName(student);
        return [student.id, label] as const;
      }),
    );

    const tutorStudentIdsByLesson = new Map<string, string[]>();
    for (const row of attendanceRows) {
      if (!row.tutorStudentId) continue;
      const list = tutorStudentIdsByLesson.get(row.lessonId) ?? [];
      if (!list.includes(row.tutorStudentId)) {
        list.push(row.tutorStudentId);
      }
      tutorStudentIdsByLesson.set(row.lessonId, list);
    }

    const allTutorStudentIds = [
      ...new Set([
        ...attendanceRows
          .map((row) => row.tutorStudentId)
          .filter((id): id is string => Boolean(id)),
        ...lessons
          .map((lesson) => lesson.primaryTutorStudentId)
          .filter((id): id is string => Boolean(id)),
      ]),
    ];
    const tutorStudents =
      allTutorStudentIds.length > 0
        ? await this.dataSource.getRepository(TutorStudentEntity).find({
            where: { id: In(allTutorStudentIds) },
            select: ['id', 'name', 'firstName', 'lastName'],
          })
        : [];
    const tutorStudentNameById = new Map(
      tutorStudents.map((row) => {
        const label = formatStudentProfileDisplayName(row);
        return [row.id, label] as const;
      }),
    );

    return lessons.map((lesson) => {
      const teacherName = lesson.teacher?.name?.trim() || null;
      let participantIds = studentIdsByLesson.get(lesson.id) ?? [];
      if (
        participantIds.length === 0 &&
        lesson.primaryStudentId &&
        !lesson.groupId
      ) {
        participantIds = [lesson.primaryStudentId];
      }

      let tutorParticipantIds = tutorStudentIdsByLesson.get(lesson.id) ?? [];
      if (
        tutorParticipantIds.length === 0 &&
        lesson.primaryTutorStudentId &&
        !lesson.groupId
      ) {
        tutorParticipantIds = [lesson.primaryTutorStudentId];
      }

      const studentNames = [
        ...participantIds.map((id) => studentNameById.get(id) || ''),
        ...tutorParticipantIds.map((id) => tutorStudentNameById.get(id) || ''),
      ].filter(Boolean);
      const studentName =
        studentNames.length > 0
          ? studentNames.join(', ')
          : lesson.primaryStudent?.name?.trim() ||
            lesson.primaryTutorStudent?.name?.trim() ||
            lesson.group?.name?.trim() ||
            null;

      delete lesson.teacher;
      delete lesson.primaryStudent;
      delete lesson.primaryTutorStudent;
      delete lesson.group;
      delete lesson.series;

      Object.assign(lesson, {
        teacherName,
        studentName,
        studentIds: participantIds.length > 0 ? participantIds : tutorParticipantIds,
        studentNames,
        tutorStudentIds: tutorParticipantIds,
      });
      return lesson;
    });
  }

  async complete(actor: JwtPayload, id: string): Promise<LessonEntity> {
    await this.lessonAccess.assertCanWriteLesson(actor, id);
    const completed = await this.finalizeLessonCompletion(id, {
      attendanceStatus: 'attended',
    });
    if (!completed) {
      throw new NotFoundException('Lesson not found');
    }
    const withNames = await this.repository.findById(completed.id);
    return (await this.attachDisplayNames([withNames ?? completed]))[0];
  }

  /**
   * Cron/system completion path — no actor ACL.
   * Reuses finalizeLessonCompletion (balance, TeacherPayment, attendance).
   * Returns null when the lesson is missing, already finalized, or ineligible.
   */
  async completeExpiredBySystem(id: string): Promise<LessonEntity | null> {
    const lesson = await this.repository.findById(id);
    if (!lesson || lesson.status !== 'planned') {
      return null;
    }
    if (!lesson.teacherId) {
      return null;
    }

    const isIndividual =
      lesson.lessonType === 'individual' &&
      !lesson.groupId &&
      !!lesson.primaryStudentId;
    const isGroup = !!lesson.groupId;

    if (!isIndividual && !isGroup) {
      return null;
    }

    if (isGroup) {
      const memberCount = await this.dataSource
        .getRepository(GroupMemberEntity)
        .count({ where: { groupId: lesson.groupId as string } });
      if (memberCount === 0) {
        return null;
      }
    }

    try {
      return await this.finalizeLessonCompletion(id, {
        attendanceStatus: 'attended',
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Keep attendance.student_id aligned with primaryStudentId for individual lessons.
   * Prevents stale "wrong student" rows after reassignment (balance + UI labels).
   */
  private async syncIndividualLessonAttendance(
    lessonId: string,
    primaryStudentId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const run = async (em: EntityManager) => {
      const attendanceRepo = em.getRepository(AttendanceEntity);
      const rows = await attendanceRepo.find({ where: { lessonId } });
      const matching = rows.find((row) => row.studentId === primaryStudentId);

      if (matching) {
        for (const row of rows) {
          if (row.id !== matching.id) {
            await attendanceRepo.delete({ id: row.id });
          }
        }
        return;
      }

      if (rows.length === 1) {
        rows[0].studentId = primaryStudentId;
        await attendanceRepo.save(rows[0]);
        return;
      }

      if (rows.length > 1) {
        const [keep, ...rest] = rows;
        keep.studentId = primaryStudentId;
        await attendanceRepo.save(keep);
        for (const row of rest) {
          await attendanceRepo.delete({ id: row.id });
        }
        return;
      }

      await attendanceRepo.save(
        attendanceRepo.create({
          lessonId,
          studentId: primaryStudentId,
          attendanceStatus: 'enrolled',
        }),
      );
    };

    if (manager) {
      await run(manager);
      return;
    }
    await this.dataSource.transaction(run);
  }

  /**
   * Single lesson-completion pipeline.
   * Only the enrolled → attended|missed attendance outcome differs by option.
   */
  private async finalizeLessonCompletion(
    lessonId: string,
    options?: { attendanceStatus?: 'attended' | 'missed' },
  ): Promise<LessonEntity | null> {
    // `completionAttendance` is a completion hint for *group* lessons.
    // For individual lessons, attendance must always be treated as present.
    const attendanceStatusHint =
      options?.attendanceStatus === 'missed' ? 'missed' : 'attended';

    return this.dataSource.transaction(async (manager) => {
      const lessonRepo = manager.getRepository(LessonEntity);
      const lesson = await lessonRepo.findOne({
        where: { id: lessonId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lesson) {
        return null;
      }

      // Only planned lessons may enter the completion pipeline (balance + TeacherPayment).
      if (lesson.status !== 'planned') {
        throw new ConflictException('Lesson is already finalized');
      }

      const isIndividual =
        lesson.lessonType === 'individual' && !lesson.groupId && !!lesson.primaryStudentId;

      if (isIndividual) {
        const primaryStudentId = lesson.primaryStudentId as string;
        await this.syncIndividualLessonAttendance(
          lesson.id,
          primaryStudentId,
          manager,
        );
      } else if (lesson.groupId) {
        await this.syncGroupLessonAttendance(lesson.id, lesson.groupId, manager);
      }

      lesson.status = 'completed';
      await lessonRepo.save(lesson);

      const attendanceRepo = manager.getRepository(AttendanceEntity);
      const finalAttendanceStatus = isIndividual ? 'attended' : attendanceStatusHint;

      if (isIndividual && lesson.primaryStudentId) {
        await attendanceRepo.update(
          { lessonId, studentId: lesson.primaryStudentId },
          { attendanceStatus: 'attended' },
        );
      } else {
        await attendanceRepo.update(
          { lessonId, attendanceStatus: 'enrolled' },
          { attendanceStatus: finalAttendanceStatus },
        );
      }

      await this.studentBalanceService.handleLessonStatusUpdate(lessonId, 'completed', manager);
      // Tutor lessons are outside school payroll — never create TeacherPayment rows.
      if (lesson.teacherId) {
        await this.teacherPaymentsService.createForCompletedLesson(lesson, manager);
      }

      if (finalAttendanceStatus === 'missed') {
        const rows = await attendanceRepo.find({ where: { lessonId } });
        for (const row of rows) {
          if (row.studentId && row.attendanceStatus === 'missed') {
            await this.enrollmentProgress.handleLessonMissed(
              lessonId,
              row.studentId,
              manager,
            );
          }
        }
      } else {
        await this.enrollmentProgress.handleLessonCompleted(lessonId, manager);
      }

      return lesson;
    });
  }

  async cancel(actor: JwtPayload, id: string): Promise<LessonEntity> {
    await this.lessonAccess.assertCanWriteLesson(actor, id);

    return this.dataSource.transaction(async (manager) => {
      const lessonRepo = manager.getRepository(LessonEntity);
      const lesson = await lessonRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lesson) {
        throw new NotFoundException('Lesson not found');
      }

      // Only planned lessons may be cancelled. Completed lessons already charged
      // balance / created TeacherPayment — reversing that requires an explicit
      // compensating flow (not silent cancel).
      if (lesson.status !== 'planned') {
        throw new ConflictException(
          'Отменить можно только запланированное занятие',
        );
      }

      lesson.status = 'cancelled';
      await lessonRepo.save(lesson);

      await manager.getRepository(AvailabilityBookingEntity).update(
        { lessonId: id },
        { status: 'cancelled' },
      );

      await manager.getRepository(AttendanceEntity).update(
        { lessonId: id },
        { attendanceStatus: 'cancelled' },
      );

      return lesson;
    });
  }

  async findAllAttendance(actor: JwtPayload): Promise<AttendanceEntity[]> {
    const where = await this.lessonAccess.scopeAttendanceFilter(actor, {});
    return this.repository.filterAttendance(where as FindOptionsWhere<AttendanceEntity>);
  }

  async findAttendanceById(actor: JwtPayload, id: string): Promise<AttendanceEntity> {
    const row = await this.repository.findAttendanceById(id);
    if (!row) {
      throw new NotFoundException('Attendance record not found');
    }
    await this.lessonAccess.assertCanReadLesson(actor, row.lessonId);
    return row;
  }

  createAttendance(dto: CreateAttendanceDto): Promise<AttendanceEntity> {
    return this.repository.saveAttendance({
      lessonId: dto.lessonId,
      studentId: dto.studentId,
      attendanceStatus: dto.attendanceStatus ?? 'enrolled',
      balanceDeducted: false,
    });
  }

  async updateAttendance(
    actor: JwtPayload,
    id: string,
    dto: UpdateAttendanceDto,
  ): Promise<AttendanceEntity> {
    return this.dataSource.transaction(async (manager) => {
      const attendanceRepo = manager.getRepository(AttendanceEntity);
      const existing = await attendanceRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!existing) {
        throw new NotFoundException('Attendance record not found');
      }
      await this.lessonAccess.assertCanWriteLesson(actor, existing.lessonId);

      const previousStatus = existing.attendanceStatus;
      if (
        normalizeRole(actor.role) === 'teacher' &&
        TEACHER_LOCKED_ATTENDANCE_STATUSES.has(previousStatus) &&
        dto.attendanceStatus !== undefined &&
        dto.attendanceStatus !== previousStatus
      ) {
        throw new ForbiddenException(
          'Посещаемость уже подтверждена и не может быть изменена',
        );
      }

      if (dto.attendanceStatus !== undefined) {
        existing.attendanceStatus = dto.attendanceStatus;
      }
      // balanceDeducted is never taken from the client — only StudentBalanceService.
      const row = await attendanceRepo.save(existing);

      if (
        existing.studentId &&
        (dto.attendanceStatus === 'missed' || dto.attendanceStatus === 'missed_no_notice') &&
        previousStatus !== 'missed' &&
        previousStatus !== 'missed_no_notice'
      ) {
        await this.enrollmentProgress.handleLessonMissed(existing.lessonId, existing.studentId);
      }

      if (dto.attendanceStatus === 'missed_no_notice') {
        const lesson = await manager.getRepository(LessonEntity).findOne({
          where: { id: existing.lessonId },
        });
        if (lesson?.status === 'completed' && !row.balanceDeducted) {
          await this.studentBalanceService.handleLessonStatusUpdate(existing.lessonId, 'completed');
        }
      }

      return row;
    });
  }

  async markPresent(actor: JwtPayload, id: string): Promise<AttendanceEntity> {
    return this.updateAttendance(actor, id, { attendanceStatus: 'attended' });
  }

  async markAbsent(actor: JwtPayload, id: string): Promise<AttendanceEntity> {
    return this.updateAttendance(actor, id, { attendanceStatus: 'missed' });
  }

  async deleteAttendance(id: string): Promise<void> {
    const row = await this.repository.findAttendanceById(id);
    if (!row) {
      throw new NotFoundException('Attendance record not found');
    }
    await this.repository.deleteAttendance(id);
  }

  async filterAttendance(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<AttendanceEntity[]> {
    const scoped = await this.lessonAccess.scopeAttendanceFilter(actor, where);
    const lessonId = this.extractScopedLessonId(scoped);
    if (lessonId) {
      await this.reconcileLessonAttendanceParticipants(lessonId);
    }
    const rows = await this.repository.filterAttendance(
      scoped as FindOptionsWhere<AttendanceEntity>,
    );
    return this.attachAttendanceStudentNames(rows);
  }

  /** Attach studentName from live Student.name (SSOT) for FE attendance panel. */
  private async attachAttendanceStudentNames(
    rows: AttendanceEntity[],
  ): Promise<AttendanceEntity[]> {
    if (rows.length === 0) {
      return rows;
    }
    const ids = [
      ...new Set(
        rows.map((row) => row.studentId).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (ids.length === 0) {
      return rows;
    }
    const students = await this.dataSource.getRepository(StudentEntity).find({
      where: { id: In(ids) },
      select: ['id', 'name', 'firstName', 'lastName'],
    });
    const labelById = new Map(
      students.map((student) => [
        student.id,
        formatStudentProfileDisplayName(student),
      ]),
    );
    for (const row of rows) {
      const label = row.studentId ? labelById.get(row.studentId) || '' : '';
      Object.assign(row, { studentName: label || null });
    }
    return rows;
  }

  /**
   * Align attendance rows with canonical lesson participants before UI/API reads.
   * Individual: primaryStudentId. Group: current group members.
   */
  private async reconcileLessonAttendanceParticipants(lessonId: string): Promise<void> {
    const lesson = await this.dataSource.getRepository(LessonEntity).findOne({
      where: { id: lessonId },
    });
    if (!lesson) {
      return;
    }

    if (lesson.lessonType === 'individual' && !lesson.groupId && lesson.primaryStudentId) {
      await this.syncIndividualLessonAttendance(lesson.id, lesson.primaryStudentId);
      return;
    }

    if (lesson.groupId) {
      await this.syncGroupLessonAttendance(lesson.id, lesson.groupId);
    }
  }

  private extractScopedLessonId(scoped: Record<string, unknown>): string | null {
    const raw = scoped.lessonId ?? scoped.lesson_id;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    return null;
  }

  private async syncGroupLessonAttendance(
    lessonId: string,
    groupId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const run = async (em: EntityManager) => {
      const memberIds = [
        ...new Set(
          (
            await em.getRepository(GroupMemberEntity).find({
              where: { groupId },
              select: ['studentId'],
            })
          )
            .map((row) => row.studentId)
            .filter(Boolean),
        ),
      ];
      if (memberIds.length === 0) {
        return;
      }

      const attendanceRepo = em.getRepository(AttendanceEntity);
      const rows = await attendanceRepo.find({ where: { lessonId } });
      const byStudent = new Map(
        rows
          .filter((row) => row.studentId)
          .map((row) => [row.studentId as string, row] as const),
      );

      for (const studentId of memberIds) {
        if (!byStudent.has(studentId)) {
          await attendanceRepo.save(
            attendanceRepo.create({
              lessonId,
              studentId,
              attendanceStatus: 'enrolled',
            }),
          );
        }
      }

      for (const row of rows) {
        if (row.studentId && !memberIds.includes(row.studentId)) {
          // Drop stale non-members that are still only enrolled.
          if (row.attendanceStatus === 'enrolled' && !row.balanceDeducted) {
            await attendanceRepo.delete({ id: row.id });
          }
        }
      }
    };

    if (manager) {
      await run(manager);
      return;
    }
    await this.dataSource.transaction(run);
  }

  private async resolveLessonStudentIds(
    dto: CreateLessonDto,
    manager: EntityManager,
  ): Promise<string[]> {
    if (dto.groupId) {
      const members = await manager.getRepository(GroupMemberEntity).find({
        where: { groupId: dto.groupId },
      });
      if (members.length === 0) {
        throw new BadRequestException('В группе нет учеников');
      }
      return members.map((member) => member.studentId);
    }

    if (dto.primaryStudentId) {
      return [dto.primaryStudentId];
    }

    throw new BadRequestException(
      'Выберите ученика для индивидуального урока или группу для группового',
    );
  }
}
