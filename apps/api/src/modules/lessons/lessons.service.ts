import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere } from 'typeorm';
import { LessonAccessService } from '../../common/access/lesson-access.service';
import { JwtPayload } from '../auth/auth.service';
import { EnrollmentProgressService } from '../courses/enrollment-progress.service';
import { GroupEntity } from '../groups/entities/group.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { AvailabilityBookingEntity } from '../schedule/entities/availability-booking.entity';
import { ScheduleService } from '../schedule/schedule.service';
import { StudentBalanceService } from '../students/student-balance.service';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TeacherPaymentsService } from '../teacher-payments/teacher-payments.service';
import { AttendanceEntity } from './entities/attendance.entity';
import { LessonEntity } from './entities/lesson.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonsRepository } from './lessons.repository';

@Injectable()
export class LessonsService {
  constructor(
    private readonly repository: LessonsRepository,
    private readonly studentBalanceService: StudentBalanceService,
    private readonly lessonAccess: LessonAccessService,
    private readonly scheduleService: ScheduleService,
    private readonly teacherPaymentsService: TeacherPaymentsService,
    private readonly enrollmentProgress: EnrollmentProgressService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(actor: JwtPayload): Promise<LessonEntity[]> {
    const where = await this.lessonAccess.scopeLessonFilter(actor, {});
    return this.repository.filter(where as FindOptionsWhere<LessonEntity>);
  }

  async findById(actor: JwtPayload, id: string): Promise<LessonEntity> {
    return this.lessonAccess.assertCanReadLesson(actor, id);
  }

  async create(dto: CreateLessonDto): Promise<LessonEntity> {
    const duration = dto.duration ?? 60;

    await this.scheduleService.assertAvailableForLesson(
      dto.teacherId,
      dto.date,
      dto.startTime,
      duration,
    );
    await this.scheduleService.assertNoScheduleConflicts(
      dto.teacherId,
      dto.date,
      dto.startTime,
      duration,
    );

    return this.dataSource.transaction(async (manager) => {
      const teacher = await manager.getRepository(TeacherEntity).findOne({
        where: { id: dto.teacherId },
      });
      if (!teacher) {
        throw new NotFoundException('Teacher not found');
      }

      if (dto.groupId) {
        const group = await manager.getRepository(GroupEntity).findOne({
          where: { id: dto.groupId },
        });
        if (!group) {
          throw new NotFoundException('Group not found');
        }
        if (group.teacherId !== dto.teacherId) {
          throw new BadRequestException('Group does not belong to the selected teacher');
        }
      }

      const lessonRepo = manager.getRepository(LessonEntity);
      const lesson = await lessonRepo.save(
        lessonRepo.create({
          ...dto,
          duration,
          status: dto.status ?? 'planned',
          lessonType: dto.lessonType ?? (dto.groupId ? 'group' : 'individual'),
        }),
      );

      const studentIds = await this.resolveLessonStudentIds(dto, manager);
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

      const timeFrom = this.scheduleService.normalizeTime(dto.startTime);
      const timeTo = this.scheduleService.addMinutesToTime(timeFrom, duration);
      await manager.getRepository(AvailabilityBookingEntity).save({
        teacherId: dto.teacherId,
        lessonId: lesson.id,
        date: dto.date,
        timeFrom,
        timeTo,
        status: 'active',
      });

      return lesson;
    });
  }

  async update(actor: JwtPayload, id: string, dto: UpdateLessonDto): Promise<LessonEntity> {
    const before = await this.repository.findById(id);
    if (!before) {
      throw new NotFoundException('Lesson not found');
    }

    const payload = await this.lessonAccess.assertCanWriteLesson(
      actor,
      id,
      dto as Record<string, unknown>,
    );

    const teacherId = (payload.teacherId as string | undefined) ?? before.teacherId;
    const date = (payload.date as string | undefined) ?? before.date;
    const startTime = (payload.startTime as string | undefined) ?? before.startTime;
    const duration = (payload.duration as number | undefined) ?? before.duration ?? 60;
    const nextStatus = (payload.status as string | undefined) ?? before.status;

    const scheduleChanged =
      teacherId !== before.teacherId ||
      date !== before.date ||
      startTime !== before.startTime ||
      duration !== (before.duration ?? 60);

    if (scheduleChanged && before.status !== 'cancelled' && nextStatus !== 'cancelled') {
      await this.scheduleService.assertAvailableForLesson(teacherId, date, startTime, duration);
      await this.scheduleService.assertNoScheduleConflicts(
        teacherId,
        date,
        startTime,
        duration,
        id,
      );
    }

    const row = await this.repository.update(id, payload as UpdateLessonDto);
    if (!row) {
      throw new NotFoundException('Lesson not found');
    }

    if (scheduleChanged) {
      const timeFrom = this.scheduleService.normalizeTime(startTime);
      const timeTo = this.scheduleService.addMinutesToTime(timeFrom, duration);
      await this.dataSource.getRepository(AvailabilityBookingEntity).update(
        { lessonId: id },
        {
          teacherId,
          date,
          timeFrom,
          timeTo,
          status: nextStatus === 'cancelled' ? 'cancelled' : 'active',
        },
      );
    }

    if (
      payload.status &&
      typeof payload.status === 'string' &&
      payload.status === 'completed' &&
      before.status !== 'completed'
    ) {
      await this.studentBalanceService.handleLessonStatusUpdate(id, payload.status);
      await this.teacherPaymentsService.createForCompletedLesson(row);
      await this.enrollmentProgress.handleLessonCompleted(id);
    } else if (
      payload.status &&
      typeof payload.status === 'string' &&
      payload.status !== before.status
    ) {
      await this.studentBalanceService.handleLessonStatusUpdate(id, payload.status);
    }
    return row;
  }

  async delete(id: string): Promise<void> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Lesson not found');
    }
    await this.repository.delete(id);
  }

  async filter(actor: JwtPayload, where: Record<string, unknown>): Promise<LessonEntity[]> {
    const scoped = await this.lessonAccess.scopeLessonFilter(actor, where);
    return this.repository.filter(scoped as FindOptionsWhere<LessonEntity>);
  }

  async complete(actor: JwtPayload, id: string): Promise<LessonEntity> {
    await this.lessonAccess.assertCanWriteLesson(actor, id);
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('Lesson not found');
    }
    if (existing.status === 'completed') {
      return existing;
    }
    const row = await this.repository.update(id, { status: 'completed' });
    if (!row) {
      throw new NotFoundException('Lesson not found');
    }
    await this.studentBalanceService.handleLessonStatusUpdate(id, 'completed');
    await this.teacherPaymentsService.createForCompletedLesson(row);
    await this.enrollmentProgress.handleLessonCompleted(id);
    return row;
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
    const existing = await this.repository.findAttendanceById(id);
    if (!existing) {
      throw new NotFoundException('Attendance record not found');
    }
    await this.lessonAccess.assertCanWriteLesson(actor, existing.lessonId);

    const row = await this.repository.updateAttendance(id, dto);
    if (!row) {
      throw new NotFoundException('Attendance record not found');
    }

    if (
      (dto.attendanceStatus === 'missed' || dto.attendanceStatus === 'missed_no_notice') &&
      existing.attendanceStatus !== 'missed' &&
      existing.attendanceStatus !== 'missed_no_notice'
    ) {
      await this.enrollmentProgress.handleLessonMissed(existing.lessonId, existing.studentId);
    }

    if (dto.attendanceStatus === 'missed_no_notice') {
      const lesson = await this.repository.findById(existing.lessonId);
      if (lesson?.status === 'completed' && !row.balanceDeducted) {
        await this.studentBalanceService.handleLessonStatusUpdate(existing.lessonId, 'completed');
      }
    }

    return row;
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
        throw new BadRequestException('Group has no students');
      }
      return members.map((member) => member.studentId);
    }

    if (dto.primaryStudentId) {
      return [dto.primaryStudentId];
    }

    throw new BadRequestException('Either groupId or primaryStudentId is required');
  }
}
