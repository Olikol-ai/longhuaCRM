import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { TeacherAccessService } from '../../common/access/teacher-access.service';
import { JwtPayload } from '../auth/auth.service';
import { ChatMembershipSyncService } from '../chats/services/chat-membership-sync.service';
import { LessonEntity, LessonStatus } from '../lessons/entities/lesson.entity';
import { ScheduleService } from '../schedule/schedule.service';
import { RoleEntitySyncService } from '../users/role-entity-sync.service';
import { UserEntity } from '../users/entities/user.entity';
import { TeacherEntity } from './entities/teacher.entity';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { TeacherDeleteResult, TeacherDeletionService } from './teacher-deletion.service';
import { TeachersRepository } from './teachers.repository';

/**
 * Lesson statuses that block a teacher for the "available teachers" hint.
 * Spec lists planned / confirmed / in_progress; only `planned` exists in the schema today.
 */
const BUSY_LESSON_STATUSES: LessonStatus[] = ['planned'];

export type AvailableTeacherHint = {
  id: string;
  name: string;
};

@Injectable()
export class TeachersService {
  constructor(
    private readonly repository: TeachersRepository,
    private readonly teacherAccess: TeacherAccessService,
    private readonly teacherDeletion: TeacherDeletionService,
    private readonly scheduleService: ScheduleService,
    private readonly roleEntitySync: RoleEntitySyncService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @Optional()
    private readonly chatMembershipSync?: ChatMembershipSyncService,
  ) {}

  async findAll(actor: JwtPayload): Promise<TeacherEntity[]> {
    const where = await this.teacherAccess.scopeTeacherFilter(actor, {});
    const rows = await this.repository.filter(where as FindOptionsWhere<TeacherEntity>);
    return this.applyUserTelegram(rows);
  }

  /**
   * Canonical active teachers for salary / admin directories.
   * Requires: Teacher.status=active, linked User exists, role=teacher, status=active.
   */
  async findActive(): Promise<TeacherEntity[]> {
    const rows = await this.userRepo.manager
      .getRepository(TeacherEntity)
      .createQueryBuilder('t')
      .innerJoin(UserEntity, 'u', 'u.id = t.user_id')
      .where('t.status = :teacherStatus', { teacherStatus: 'active' })
      .andWhere('u.role = :role', { role: 'teacher' })
      .andWhere('u.status = :userStatus', { userStatus: 'active' })
      .orderBy('t.name', 'ASC')
      .getMany();
    return this.applyUserTelegram(rows);
  }

  /** Same SSOT as findActive — COUNT for Admin Dashboard. */
  async countActive(): Promise<number> {
    return this.userRepo.manager
      .getRepository(TeacherEntity)
      .createQueryBuilder('t')
      .innerJoin(UserEntity, 'u', 'u.id = t.user_id')
      .where('t.status = :teacherStatus', { teacherStatus: 'active' })
      .andWhere('u.role = :role', { role: 'teacher' })
      .andWhere('u.status = :userStatus', { userStatus: 'active' })
      .getCount();
  }

  async findById(actor: JwtPayload, id: string): Promise<TeacherEntity> {
    await this.teacherAccess.assertCanReadTeacher(actor, id);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Teacher not found');
    }
    const [enriched] = await this.applyUserTelegram([row]);
    return enriched;
  }

  async create(dto: CreateTeacherDto): Promise<TeacherEntity> {
    const { subjectIds, ...rest } = dto;
    const teacher = await this.repository.save(rest);
    if (this.chatMembershipSync) {
      if (subjectIds !== undefined) {
        await this.chatMembershipSync.setTeacherSubjects(teacher.id, subjectIds);
      } else {
        await this.chatMembershipSync.assignDefaultTeachingSubject(teacher.id, 'teacher');
      }
    }
    return teacher;
  }

  async update(actor: JwtPayload, id: string, dto: UpdateTeacherDto): Promise<TeacherEntity> {
    const { subjectIds, ...rest } = dto;
    const payload = await this.teacherAccess.assertCanUpdateTeacher(
      actor,
      id,
      rest as Record<string, unknown>,
    );
    const row = await this.repository.update(id, payload as UpdateTeacherDto);
    if (!row) {
      throw new NotFoundException('Teacher not found');
    }

    const nameTouched =
      (payload as Record<string, unknown>).name !== undefined ||
      (payload as Record<string, unknown>).firstName !== undefined ||
      (payload as Record<string, unknown>).lastName !== undefined;

    let result = row;
    if (nameTouched) {
      this.roleEntitySync.normalizeTeacherNameFields(row);
      const saved = await this.repository.update(id, {
        name: row.name,
        firstName: row.firstName,
        lastName: row.lastName,
      });
      const synced = saved ?? row;
      await this.roleEntitySync.syncLinkedUserFromTeacher(synced);
      result = synced;
    }

    if (this.chatMembershipSync) {
      if (subjectIds !== undefined) {
        await this.chatMembershipSync.setTeacherSubjects(id, subjectIds);
      } else if (
        Object.prototype.hasOwnProperty.call(payload, 'userId')
        || Object.prototype.hasOwnProperty.call(payload, 'status')
      ) {
        await this.chatMembershipSync.syncSubjectChatsForTeacher(id);
      }
    }

    return result;
  }

  delete(id: string): Promise<TeacherDeleteResult> {
    return this.teacherDeletion.deleteTeacher(id);
  }

  async filter(actor: JwtPayload, where: Record<string, unknown>): Promise<TeacherEntity[]> {
    const scoped = await this.teacherAccess.scopeTeacherFilter(actor, where);
    const rows = await this.repository.filter(scoped as FindOptionsWhere<TeacherEntity>);
    return this.applyUserTelegram(rows);
  }

  /**
   * Advisory list of active teachers free for the given slot (interval overlap).
   * Uses saved Teacher Availability + excludes teachers with overlapping lessons.
   * Does not enforce booking rules — creation still uses existing schedule checks.
   */
  async findAvailableForSlot(params: {
    date: string;
    startTime: string;
    duration?: number;
  }): Promise<AvailableTeacherHint[]> {
    const date = String(params.date ?? '').trim();
    const startTime = String(params.startTime ?? '').trim();
    const duration = Number(params.duration) > 0 ? Number(params.duration) : 60;

    if (!date || !startTime) {
      throw new BadRequestException('date and startTime are required');
    }

    const slotFrom = this.scheduleService.normalizeTime(startTime);
    const slotTo = this.scheduleService.addMinutesToTime(slotFrom, duration);

    const activeTeachers = await this.repository.filter({ status: 'active' });
    if (activeTeachers.length === 0) {
      return [];
    }

    const teacherIds = activeTeachers.map((t) => t.id);
    const lessons = await this.lessonRepo.find({
      where: {
        date,
        teacherId: In(teacherIds),
        status: In(BUSY_LESSON_STATUSES),
      },
      select: ['id', 'teacherId', 'startTime', 'duration', 'status'],
    });

    const busyTeacherIds = new Set<string>();
    for (const lesson of lessons) {
      if (!lesson.teacherId) continue;
      const lessonFrom = this.scheduleService.normalizeTime(lesson.startTime);
      const lessonTo = this.scheduleService.addMinutesToTime(
        lessonFrom,
        lesson.duration || 60,
      );
      if (this.scheduleService.rangesOverlap(slotFrom, slotTo, lessonFrom, lessonTo)) {
        busyTeacherIds.add(lesson.teacherId);
      }
    }

    const slotsByTeacher = await this.scheduleService.loadSlotsForTeachers(teacherIds);

    const freeTeachers: AvailableTeacherHint[] = [];
    for (const teacher of activeTeachers) {
      if (busyTeacherIds.has(teacher.id)) {
        continue;
      }
      const availabilitySlots = slotsByTeacher.get(teacher.id) ?? [];
      if (
        !this.scheduleService.isTeacherFreeForSlot(
          availabilitySlots,
          date,
          startTime,
          duration,
        )
      ) {
        continue;
      }
      freeTeachers.push({ id: teacher.id, name: teacher.name });
    }

    return freeTeachers.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  /** Prefer linked User.telegram_id for API responses (source of truth). */
  private async applyUserTelegram(rows: TeacherEntity[]): Promise<TeacherEntity[]> {
    const userIds = [
      ...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id))),
    ];
    if (userIds.length === 0) {
      return rows;
    }

    const users = await this.userRepo.find({ where: { id: In(userIds) } });
    const byId = new Map(users.map((user) => [user.id, user]));

    for (const row of rows) {
      if (!row.userId) continue;
      const user = byId.get(row.userId);
      const telegramId = (user?.telegramId ?? '').trim();
      if (!telegramId) continue;
      row.telegramId = telegramId;
    }
    return rows;
  }
}
