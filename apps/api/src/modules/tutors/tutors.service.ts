import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { FindOptionsWhere, Not, Repository } from 'typeorm';
import { TutorAccessService } from '../../common/access/tutor-access.service';
import { TutorStudentAccessService } from '../../common/access/tutor-student-access.service';
import { JwtPayload } from '../auth/auth.service';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { RoleEntitySyncService } from '../users/role-entity-sync.service';
import { resolveNameParts } from '../users/display-name.util';
import { CreateTutorDto } from './dto/create-tutor.dto';
import { CreateTutorStudentNotebookDto } from './dto/create-tutor-student-notebook.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { UpdateTutorStudentNotebookDto } from './dto/update-tutor-student-notebook.dto';
import { TutorStudentEntity } from './entities/tutor-student.entity';
import { TutorEntity } from './entities/tutor.entity';
import { TutorDeleteResult, TutorDeletionService } from './tutor-deletion.service';
import { TutorsRepository } from './tutors.repository';

export type TutorActivityItem = {
  lessonId: string;
  date: string;
  startTime: string;
  duration: number;
  status: string;
  studentName: string | null;
};

export type TutorStats = {
  tutorId: string;
  studentsCount: number;
  activeStudentsCount: number;
  completedLessonsCount: number;
  teachingMinutes: number;
  teachingHours: number;
  upcomingLessonsCount: number;
  /** Completed lessons in the current calendar month. */
  monthlyLessonsCount: number;
  monthlyTeachingMinutes: number;
  monthlyTeachingHours: number;
  lastActivityAt: string | null;
  activityHistory: TutorActivityItem[];
};

export type TutorLessonRow = {
  id: string;
  date: string;
  startTime: string;
  duration: number;
  status: string;
  studentName: string | null;
  studentId: string | null;
  notes: string | null;
};

export type TutorAdminOverviewRow = {
  tutorId: string;
  displayName: string;
  email: string | null;
  status: string;
  studentsCount: number;
  activeStudentsCount: number;
  completedLessonsCount: number;
  teachingMinutes: number;
  teachingHours: number;
  upcomingLessonsCount: number;
  lastActivityAt: string | null;
};

@Injectable()
export class TutorsService {
  constructor(
    private readonly repository: TutorsRepository,
    private readonly tutorAccess: TutorAccessService,
    private readonly tutorStudentAccess: TutorStudentAccessService,
    private readonly tutorDeletion: TutorDeletionService,
    private readonly roleEntitySync: RoleEntitySyncService,
    @InjectRepository(TutorStudentEntity)
    private readonly tutorStudentRepo: Repository<TutorStudentEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
  ) {}

  async findAll(actor: JwtPayload): Promise<TutorEntity[]> {
    const where = await this.tutorAccess.scopeTutorFilter(actor, {});
    return this.repository.filter(where as FindOptionsWhere<TutorEntity>);
  }

  async findById(actor: JwtPayload, id: string): Promise<TutorEntity> {
    await this.tutorAccess.assertCanReadTutor(actor, id);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Tutor not found');
    }
    return row;
  }

  async findMe(actor: JwtPayload): Promise<TutorEntity> {
    const tutorId = await this.tutorAccess.resolveTutorId(actor);
    if (!tutorId) {
      throw new NotFoundException('Tutor profile not found');
    }
    return this.findById(actor, tutorId);
  }

  async listStudents(actor: JwtPayload, tutorId?: string): Promise<TutorStudentEntity[]> {
    let id = tutorId;
    if (!id) {
      id = (await this.tutorAccess.resolveTutorId(actor)) ?? undefined;
    }
    if (!id) {
      throw new NotFoundException('Tutor profile not found');
    }
    await this.tutorStudentAccess.assertCanListForTutor(actor, id);
    return this.tutorStudentRepo.find({
      where: { tutorId: id, status: Not('inactive' as TutorStudentEntity['status']) },
      order: { name: 'ASC' },
    });
  }

  /**
   * Create a private notebook entry for a tutor (own cabinet or admin on behalf).
   * Never creates User / school Student / balance / CRM registration.
   */
  async createNotebookStudent(
    actor: JwtPayload,
    dto: CreateTutorStudentNotebookDto,
    forTutorId?: string,
  ): Promise<TutorStudentEntity> {
    let tutorId = forTutorId;
    if (!tutorId) {
      tutorId = (await this.tutorAccess.resolveTutorId(actor)) ?? undefined;
    }
    if (!tutorId) {
      throw new NotFoundException('Tutor profile not found');
    }
    await this.tutorStudentAccess.assertCanListForTutor(actor, tutorId);

    const name = String(dto.name || '').trim();
    const parts = resolveNameParts({ name, nameIsSource: true });
    const notes = this.normalizeOptionalText(dto.notes ?? dto.comment);
    const phone = this.normalizeOptionalText(dto.phone);

    return this.tutorStudentRepo.save(
      this.tutorStudentRepo.create({
        id: randomUUID(),
        tutorId,
        userId: null,
        name: parts.name || name,
        firstName: parts.firstName || null,
        lastName: parts.lastName || null,
        email: null,
        phone,
        notes,
        telegramId: null,
        telegramUsername: null,
        inviteLinkId: null,
        status: 'active',
      }),
    );
  }

  async updateNotebookStudent(
    actor: JwtPayload,
    studentId: string,
    dto: UpdateTutorStudentNotebookDto,
    expectedTutorId?: string,
  ): Promise<TutorStudentEntity> {
    const row = await this.tutorStudentAccess.assertCanWriteTutorStudent(actor, studentId);
    this.assertNotebookBelongsToTutor(row, expectedTutorId);

    if (dto.name !== undefined) {
      const name = String(dto.name || '').trim();
      if (!name) {
        throw new BadRequestException('ФИО обязательно');
      }
      const parts = resolveNameParts({ name, nameIsSource: true });
      row.name = parts.name || name;
      row.firstName = parts.firstName || null;
      row.lastName = parts.lastName || null;
    }
    if (dto.phone !== undefined) {
      row.phone = this.normalizeOptionalText(dto.phone);
    }
    if (dto.notes !== undefined || dto.comment !== undefined) {
      row.notes = this.normalizeOptionalText(
        dto.notes !== undefined ? dto.notes : dto.comment,
      );
    }

    return this.tutorStudentRepo.save(row);
  }

  /** Soft-delete notebook entry (keeps lesson history). */
  async deleteNotebookStudent(
    actor: JwtPayload,
    studentId: string,
    expectedTutorId?: string,
  ): Promise<{ id: string; deleted: true }> {
    const row = await this.tutorStudentAccess.assertCanWriteTutorStudent(actor, studentId);
    this.assertNotebookBelongsToTutor(row, expectedTutorId);
    row.status = 'inactive';
    await this.tutorStudentRepo.save(row);
    return { id: row.id, deleted: true };
  }

  private assertNotebookBelongsToTutor(
    row: TutorStudentEntity,
    expectedTutorId?: string,
  ): void {
    if (expectedTutorId && row.tutorId !== expectedTutorId) {
      throw new NotFoundException('Ученик репетитора не найден');
    }
  }

  /** Lessons owned by this tutor only (never school teacher schedule). */
  async listLessons(
    actor: JwtPayload,
    tutorId: string,
  ): Promise<TutorLessonRow[]> {
    await this.tutorAccess.assertCanReadTutor(actor, tutorId);
    const lessons = await this.lessonRepo.find({
      where: { tutorId },
      relations: ['primaryTutorStudent'],
      order: { date: 'DESC', startTime: 'DESC' },
      take: 500,
    });
    return lessons.map((l) => ({
      id: l.id,
      date: l.date,
      startTime: String(l.startTime).slice(0, 5),
      duration: Number(l.duration ?? 60),
      status: l.status,
      studentName: l.primaryTutorStudent?.name?.trim() || null,
      studentId: l.primaryTutorStudentId,
      notes: l.notes ?? null,
    }));
  }

  private normalizeOptionalText(value: unknown): string | null {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }

  async listAllTutorStudents(actor: JwtPayload): Promise<TutorStudentEntity[]> {
    if (actor.role !== 'admin') {
      return this.listStudents(actor);
    }
    return this.tutorStudentRepo.find({
      order: { name: 'ASC' },
      relations: ['tutor'],
    });
  }

  create(dto: CreateTutorDto): Promise<TutorEntity> {
    return this.repository.save({
      displayName: dto.displayName,
      bio: dto.bio ?? null,
      specializations: dto.specializations ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      status: dto.status ?? 'pending',
      userId: dto.userId ?? null,
      defaultLessonPrice: dto.defaultLessonPrice ?? null,
      commissionPercent: dto.commissionPercent ?? 1,
      payoutAccountRef: dto.payoutAccountRef ?? null,
    });
  }

  async update(
    actor: JwtPayload,
    id: string,
    dto: UpdateTutorDto,
  ): Promise<TutorEntity> {
    const payload = await this.tutorAccess.assertCanUpdateTutor(
      actor,
      id,
      dto as Record<string, unknown>,
    );

    const mapped: Partial<TutorEntity> = {};
    if (payload.displayName !== undefined) {
      mapped.displayName = String(payload.displayName);
    }
    if (payload.bio !== undefined) {
      mapped.bio = payload.bio == null ? null : String(payload.bio);
    }
    if (payload.specializations !== undefined) {
      mapped.specializations =
        payload.specializations == null ? null : String(payload.specializations);
    }
    if (payload.email !== undefined) {
      mapped.email = payload.email == null ? null : String(payload.email);
    }
    if (payload.phone !== undefined) {
      mapped.phone = payload.phone == null ? null : String(payload.phone);
    }
    if (payload.status !== undefined) {
      mapped.status = payload.status as TutorEntity['status'];
    }
    if (payload.userId !== undefined) {
      mapped.userId = payload.userId == null ? null : String(payload.userId);
    }

    const row = await this.repository.update(id, mapped);
    if (!row) {
      throw new NotFoundException('Tutor not found');
    }

    if (mapped.displayName !== undefined && row.userId) {
      await this.roleEntitySync.syncLinkedUserFromTutor(row);
    }

    return row;
  }

  delete(id: string): Promise<TutorDeleteResult> {
    return this.tutorDeletion.deleteTutor(id);
  }

  async filter(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<TutorEntity[]> {
    const scoped = await this.tutorAccess.scopeTutorFilter(actor, where);
    return this.repository.filter(scoped as FindOptionsWhere<TutorEntity>);
  }

  /** Admin platform-usage overview for all tutors (no finance). */
  async adminOverview(): Promise<TutorAdminOverviewRow[]> {
    const tutors = await this.repository.findAll();
    const rows: TutorAdminOverviewRow[] = [];
    for (const tutor of tutors) {
      const stats = await this.computeStats(tutor.id);
      rows.push({
        tutorId: tutor.id,
        displayName: tutor.displayName,
        email: tutor.email,
        status: tutor.status,
        studentsCount: stats.studentsCount,
        activeStudentsCount: stats.activeStudentsCount,
        completedLessonsCount: stats.completedLessonsCount,
        teachingMinutes: stats.teachingMinutes,
        teachingHours: stats.teachingHours,
        upcomingLessonsCount: stats.upcomingLessonsCount,
        lastActivityAt: stats.lastActivityAt,
      });
    }
    return rows.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'ru', { sensitivity: 'base' }),
    );
  }

  async getStats(actor: JwtPayload, tutorId?: string): Promise<TutorStats> {
    let id = tutorId;
    if (!id) {
      id = (await this.tutorAccess.resolveTutorId(actor)) ?? undefined;
    }
    if (!id) {
      throw new NotFoundException('Tutor profile not found');
    }
    await this.tutorAccess.assertCanReadTutor(actor, id);
    return this.computeStats(id);
  }

  private async computeStats(tutorId: string): Promise<TutorStats> {
    const students = await this.tutorStudentRepo.find({
      where: { tutorId },
      select: ['id', 'status', 'name'],
    });
    const lessons = await this.lessonRepo.find({
      where: { tutorId },
      select: [
        'id',
        'status',
        'duration',
        'date',
        'startTime',
        'primaryTutorStudentId',
        'updatedAt',
      ],
      order: { date: 'DESC', startTime: 'DESC' },
    });

    const completed = lessons.filter((l) => l.status === 'completed');
    const upcoming = lessons.filter((l) => l.status === 'planned');
    const teachingMinutes = completed.reduce(
      (sum, l) => sum + Number(l.duration ?? 60),
      0,
    );

    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyCompleted = completed.filter((l) =>
      String(l.date || '').startsWith(monthPrefix),
    );
    const monthlyTeachingMinutes = monthlyCompleted.reduce(
      (sum, l) => sum + Number(l.duration ?? 60),
      0,
    );

    const studentNameById = new Map(
      students.map((s) => [s.id, s.name?.trim() || null]),
    );

    let lastActivityAt: string | null = null;
    if (completed.length > 0) {
      const latest = completed[0];
      lastActivityAt = `${latest.date}T${String(latest.startTime).slice(0, 8)}`;
    } else if (lessons.length > 0 && lessons[0].updatedAt) {
      lastActivityAt = lessons[0].updatedAt.toISOString();
    }

    const activityHistory: TutorActivityItem[] = completed.slice(0, 50).map((l) => ({
      lessonId: l.id,
      date: l.date,
      startTime: String(l.startTime).slice(0, 5),
      duration: Number(l.duration ?? 60),
      status: l.status,
      studentName: l.primaryTutorStudentId
        ? studentNameById.get(l.primaryTutorStudentId) ?? null
        : null,
    }));

    const activeStudents = students.filter((s) => s.status === 'active');

    return {
      tutorId,
      studentsCount: activeStudents.length,
      activeStudentsCount: activeStudents.length,
      completedLessonsCount: completed.length,
      teachingMinutes,
      teachingHours: Math.round((teachingMinutes / 60) * 10) / 10,
      upcomingLessonsCount: upcoming.length,
      monthlyLessonsCount: monthlyCompleted.length,
      monthlyTeachingMinutes,
      monthlyTeachingHours: Math.round((monthlyTeachingMinutes / 60) * 10) / 10,
      lastActivityAt,
      activityHistory,
    };
  }
}
