import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere } from 'typeorm';
import { LessonAccessService } from '../../common/access/lesson-access.service';
import { TeacherAccessService } from '../../common/access/teacher-access.service';
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
import { AttendanceEntity } from './entities/attendance.entity';
import { LessonEntity } from './entities/lesson.entity';
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
import { LessonsRepository } from './lessons.repository';

@Injectable()
export class LessonsService {
  constructor(
    private readonly repository: LessonsRepository,
    private readonly studentBalanceService: StudentBalanceService,
    private readonly lessonAccess: LessonAccessService,
    private readonly teacherAccess: TeacherAccessService,
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
    return this.attachDisplayNames([row])[0];
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
      });
      if (!teacher) {
        throw new NotFoundException('Преподаватель не найден');
      }

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
          teacherId: normalized.teacherId,
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
        teacherId: normalized.teacherId,
        lessonId: lesson.id,
        date: normalized.date,
        timeFrom,
        timeTo,
        status: 'active',
      });

      return lesson;
    });

    const withNames = await this.repository.findById(created.id);
    return this.attachDisplayNames([withNames ?? created])[0];
  }

  private normalizeCreateLessonDto(dto: CreateLessonDto): CreateLessonDto {
    const primaryStudentId = dto.primaryStudentId || dto.studentId || undefined;
    return {
      ...dto,
      primaryStudentId,
      studentId: undefined,
      lessonType: dto.lessonType ?? (dto.groupId ? 'group' : primaryStudentId ? 'individual' : undefined),
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
      if (!teacherId || dto.teacherId !== teacherId) {
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

    const completing =
      payload.status &&
      typeof payload.status === 'string' &&
      payload.status === 'completed' &&
      before.status !== 'completed';

    if (completing) {
      const completed = await this.finalizeLessonCompletion(id);
      if (completed) {
        const withNames = await this.repository.findById(completed.id);
        return this.attachDisplayNames([withNames ?? completed])[0];
      }
      throw new NotFoundException('Lesson not found');
    }

    const teacherId = (payload.teacherId as string | undefined) ?? before.teacherId;
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
      timeRescheduled || teacherId !== before.teacherId;

    const infoChanges = this.collectLessonInfoChanges(before, payload);

    if (
      scheduleSlotChanged &&
      before.status !== 'cancelled' &&
      nextStatus !== 'cancelled' &&
      teacherId
    ) {
      await this.scheduleService.assertAvailableForLesson(teacherId, date, startTime, duration);
      await this.scheduleService.assertNoScheduleConflicts(
        teacherId,
        date,
        startTime,
        duration,
        id,
      );
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

    const row = await this.repository.update(id, payload as UpdateLessonDto);
    if (!row) {
      throw new NotFoundException('Lesson not found');
    }

    if (scheduleSlotChanged) {
      const timeFrom = this.scheduleService.normalizeTime(startTime);
      const timeTo = this.scheduleService.addMinutesToTime(timeFrom, duration);
      const bookingUpdate: Partial<AvailabilityBookingEntity> = {
        date,
        timeFrom,
        timeTo,
        status: nextStatus === 'cancelled' ? 'cancelled' : 'active',
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
    return this.attachDisplayNames([row])[0];
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
   * Attach teacher_name / student_name from relations for FE display.
   * Relations are cleared from the payload to keep the API surface flat.
   */
  private attachDisplayNames(lessons: LessonEntity[]): LessonEntity[] {
    return lessons.map((lesson) => {
      const teacherName = lesson.teacher?.name?.trim() || null;
      const studentName =
        lesson.primaryStudent?.name?.trim() ||
        lesson.group?.name?.trim() ||
        null;

      delete lesson.teacher;
      delete lesson.primaryStudent;
      delete lesson.group;
      delete lesson.series;

      Object.assign(lesson, { teacherName, studentName });
      return lesson;
    });
  }

  async complete(actor: JwtPayload, id: string): Promise<LessonEntity> {
    await this.lessonAccess.assertCanWriteLesson(actor, id);
    const completed = await this.finalizeLessonCompletion(id);
    if (!completed) {
      throw new NotFoundException('Lesson not found');
    }
    const withNames = await this.repository.findById(completed.id);
    return this.attachDisplayNames([withNames ?? completed])[0];
  }

  private async finalizeLessonCompletion(lessonId: string): Promise<LessonEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const lessonRepo = manager.getRepository(LessonEntity);
      const lesson = await lessonRepo.findOne({
        where: { id: lessonId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lesson) {
        return null;
      }

      if (lesson.status === 'completed') {
        return lesson;
      }

      lesson.status = 'completed';
      await lessonRepo.save(lesson);

      await this.studentBalanceService.handleLessonStatusUpdate(lessonId, 'completed', manager);
      await this.teacherPaymentsService.createForCompletedLesson(lesson, manager);
      await this.enrollmentProgress.handleLessonCompleted(lessonId, manager);

      return lesson;
    });
  }

  async cancel(actor: JwtPayload, id: string): Promise<LessonEntity> {
    await this.lessonAccess.assertCanWriteLesson(actor, id);

    return this.dataSource.transaction(async (manager) => {
      const lessonRepo = manager.getRepository(LessonEntity);
      const lesson = await lessonRepo.findOne({ where: { id } });
      if (!lesson) {
        throw new NotFoundException('Lesson not found');
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
    return this.repository.saveAttendance(dto);
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
      if (dto.attendanceStatus !== undefined) {
        existing.attendanceStatus = dto.attendanceStatus;
      }
      if (dto.balanceDeducted !== undefined) {
        existing.balanceDeducted = dto.balanceDeducted;
      }
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
    return this.repository.filterAttendance(scoped as FindOptionsWhere<AttendanceEntity>);
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
