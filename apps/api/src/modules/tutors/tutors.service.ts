import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { FindOptionsWhere, In, Not, Repository } from 'typeorm';
import { TutorAccessService } from '../../common/access/tutor-access.service';
import { TutorStudentAccessService } from '../../common/access/tutor-student-access.service';
import { JwtPayload } from '../auth/auth.service';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { RoleEntitySyncService } from '../users/role-entity-sync.service';
import { resolveNameParts } from '../users/display-name.util';
import { CreateTutorDto } from './dto/create-tutor.dto';
import { CreateTutorMaterialDto } from './dto/create-tutor-material.dto';
import { CreateTutorStudentNotebookDto } from './dto/create-tutor-student-notebook.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { UpdateTutorMaterialDto } from './dto/update-tutor-material.dto';
import { UpdateTutorStudentNotebookDto } from './dto/update-tutor-student-notebook.dto';
import { TutorLearningDirectionEntity } from './entities/tutor-learning-direction.entity';
import {
  TUTOR_ALLOWED_LESSON_DURATIONS,
  TutorLessonDurationEntity,
} from './entities/tutor-lesson-duration.entity';
import { TutorMaterialEntity } from './entities/tutor-material.entity';
import { TutorStudentEntity } from './entities/tutor-student.entity';
import { TutorTeachingLanguageEntity } from './entities/tutor-teaching-language.entity';
import { TutorWorkDayEntity } from './entities/tutor-work-day.entity';
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
    @InjectRepository(TutorLearningDirectionEntity)
    private readonly directionRepo: Repository<TutorLearningDirectionEntity>,
    @InjectRepository(TutorTeachingLanguageEntity)
    private readonly languageRepo: Repository<TutorTeachingLanguageEntity>,
    @InjectRepository(TutorLessonDurationEntity)
    private readonly durationRepo: Repository<TutorLessonDurationEntity>,
    @InjectRepository(TutorWorkDayEntity)
    private readonly workDayRepo: Repository<TutorWorkDayEntity>,
    @InjectRepository(TutorMaterialEntity)
    private readonly materialRepo: Repository<TutorMaterialEntity>,
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

  /** Soft-delete notebook entry (keeps lesson history). Refuses registered users. */
  async deleteNotebookStudent(
    actor: JwtPayload,
    studentId: string,
    expectedTutorId?: string,
  ): Promise<{ id: string; deleted: true; cancelledLessons: number; archived: true }> {
    const row = await this.tutorStudentAccess.assertCanWriteTutorStudent(actor, studentId);
    this.assertNotebookBelongsToTutor(row, expectedTutorId);
    if (row.userId) {
      throw new BadRequestException(
        'Нельзя удалить зарегистрированного ученика репетитора',
      );
    }

    const planned = await this.lessonRepo.find({
      where: {
        primaryTutorStudentId: row.id,
        status: 'planned',
      },
      select: ['id'],
    });
    if (planned.length > 0) {
      await this.lessonRepo.update(
        { id: In(planned.map((lesson) => lesson.id)) },
        { status: 'cancelled' },
      );
    }

    row.status = 'inactive';
    await this.tutorStudentRepo.save(row);
    return {
      id: row.id,
      deleted: true,
      archived: true,
      cancelledLessons: planned.length,
    };
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
    if (payload.photoUrl !== undefined) {
      mapped.photoUrl = this.normalizeOptionalText(payload.photoUrl);
    }
    if (payload.bio !== undefined) {
      mapped.bio = this.normalizeOptionalText(payload.bio);
    }
    if (payload.teachingExperience !== undefined) {
      mapped.teachingExperience = this.normalizeOptionalText(
        payload.teachingExperience,
      );
    }
    if (payload.specialization !== undefined) {
      mapped.specialization = this.normalizeOptionalText(payload.specialization);
    }
    if (payload.specializations !== undefined) {
      mapped.specializations = this.normalizeOptionalText(payload.specializations);
    }
    if (payload.email !== undefined) {
      mapped.email = payload.email == null ? null : String(payload.email);
    }
    if (payload.phone !== undefined) {
      mapped.phone = this.normalizeOptionalText(payload.phone);
    }
    if (payload.status !== undefined) {
      mapped.status = payload.status as TutorEntity['status'];
    }
    if (payload.userId !== undefined) {
      mapped.userId = payload.userId == null ? null : String(payload.userId);
    }
    if (payload.defaultLessonPrice !== undefined) {
      mapped.defaultLessonPrice =
        payload.defaultLessonPrice == null
          ? null
          : Number(payload.defaultLessonPrice);
    }
    if (payload.commissionPercent !== undefined) {
      mapped.commissionPercent =
        payload.commissionPercent == null
          ? null
          : Number(payload.commissionPercent);
    }
    if (payload.payoutAccountRef !== undefined) {
      mapped.payoutAccountRef = this.normalizeOptionalText(
        payload.payoutAccountRef,
      );
    }
    if (payload.workTimeFrom !== undefined) {
      mapped.workTimeFrom = this.normalizeTime(payload.workTimeFrom);
    }
    if (payload.workTimeTo !== undefined) {
      mapped.workTimeTo = this.normalizeTime(payload.workTimeTo);
    }

    if (Object.keys(mapped).length > 0) {
      const row = await this.repository.update(id, mapped);
      if (!row) {
        throw new NotFoundException('Tutor not found');
      }
      if (mapped.displayName !== undefined && row.userId) {
        await this.roleEntitySync.syncLinkedUserFromTutor(row);
      }
    } else {
      const existing = await this.repository.findById(id);
      if (!existing) {
        throw new NotFoundException('Tutor not found');
      }
    }

    if (payload.learningDirections !== undefined) {
      await this.replaceNamedList(
        'directions',
        id,
        payload.learningDirections as unknown[],
      );
    }
    if (payload.teachingLanguages !== undefined) {
      await this.replaceNamedList(
        'languages',
        id,
        payload.teachingLanguages as unknown[],
      );
    }
    if (payload.lessonDurations !== undefined) {
      await this.replaceLessonDurations(id, payload.lessonDurations as unknown[]);
    }
    if (payload.workDays !== undefined) {
      await this.replaceWorkDays(id, payload.workDays as unknown[]);
    }

    const refreshed = await this.repository.findById(id);
    if (!refreshed) {
      throw new NotFoundException('Tutor not found');
    }
    return refreshed;
  }

  private normalizeTime(value: unknown): string | null {
    if (value == null || value === '') return null;
    const raw = String(value).trim();
    const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(raw);
    if (!match) {
      throw new BadRequestException('Некорректное время (ожидается ЧЧ:ММ)');
    }
    return `${match[1]}:${match[2]}`;
  }

  private async replaceNamedList(
    kind: 'directions' | 'languages',
    tutorId: string,
    values: unknown[],
  ): Promise<void> {
    const names = (Array.isArray(values) ? values : [])
      .map((v) => String(v ?? '').trim())
      .filter(Boolean);
    if (kind === 'directions') {
      await this.directionRepo.delete({ tutorId });
      if (names.length === 0) return;
      await this.directionRepo.save(
        names.map((name, index) =>
          this.directionRepo.create({
            id: randomUUID(),
            tutorId,
            name,
            sortOrder: index,
          }),
        ),
      );
      return;
    }
    await this.languageRepo.delete({ tutorId });
    if (names.length === 0) return;
    await this.languageRepo.save(
      names.map((name, index) =>
        this.languageRepo.create({
          id: randomUUID(),
          tutorId,
          name,
          sortOrder: index,
        }),
      ),
    );
  }

  private async replaceLessonDurations(
    tutorId: string,
    values: unknown[],
  ): Promise<void> {
    const allowed = new Set<number>(TUTOR_ALLOWED_LESSON_DURATIONS);
    const minutes = [
      ...new Set(
        (Array.isArray(values) ? values : []).map((v) => Number(v)),
      ),
    ].filter((n) => allowed.has(n));
    if (
      (Array.isArray(values) ? values : []).some(
        (v) => !allowed.has(Number(v)),
      )
    ) {
      throw new BadRequestException(
        'Допустимая длительность: 30, 60, 90 или 120 минут',
      );
    }
    await this.durationRepo.delete({ tutorId });
    if (minutes.length === 0) return;
    await this.durationRepo.save(
      minutes.map((m) =>
        this.durationRepo.create({
          id: randomUUID(),
          tutorId,
          minutes: m,
        }),
      ),
    );
  }

  private async replaceWorkDays(
    tutorId: string,
    values: unknown[],
  ): Promise<void> {
    const days = [
      ...new Set((Array.isArray(values) ? values : []).map((v) => Number(v))),
    ].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (
      (Array.isArray(values) ? values : []).some((v) => {
        const n = Number(v);
        return !Number.isInteger(n) || n < 0 || n > 6;
      })
    ) {
      throw new BadRequestException('День недели должен быть от 0 (пн) до 6 (вс)');
    }
    await this.workDayRepo.delete({ tutorId });
    if (days.length === 0) return;
    await this.workDayRepo.save(
      days.map((dayOfWeek) =>
        this.workDayRepo.create({
          id: randomUUID(),
          tutorId,
          dayOfWeek,
        }),
      ),
    );
  }

  async listMaterials(
    actor: JwtPayload,
    tutorId: string,
  ): Promise<TutorMaterialEntity[]> {
    await this.tutorAccess.assertCanReadTutor(actor, tutorId);
    return this.materialRepo.find({
      where: { tutorId },
      order: { createdAt: 'DESC' },
    });
  }

  async createMaterial(
    actor: JwtPayload,
    tutorId: string,
    dto: CreateTutorMaterialDto,
  ): Promise<TutorMaterialEntity> {
    await this.tutorAccess.assertCanUpdateTutor(actor, tutorId, {});
    const title = String(dto.title || '').trim();
    if (!title) {
      throw new BadRequestException('Укажите название материала');
    }
    return this.materialRepo.save(
      this.materialRepo.create({
        id: randomUUID(),
        tutorId,
        title,
        description: this.normalizeOptionalText(dto.description),
        externalLink: this.normalizeOptionalText(dto.externalLink),
        fileUrl: this.normalizeOptionalText(dto.fileUrl),
      }),
    );
  }

  async updateMaterial(
    actor: JwtPayload,
    tutorId: string,
    materialId: string,
    dto: UpdateTutorMaterialDto,
  ): Promise<TutorMaterialEntity> {
    await this.tutorAccess.assertCanUpdateTutor(actor, tutorId, {});
    const row = await this.materialRepo.findOne({
      where: { id: materialId, tutorId },
    });
    if (!row) {
      throw new NotFoundException('Материал не найден');
    }
    if (dto.title !== undefined) {
      const title = String(dto.title || '').trim();
      if (!title) {
        throw new BadRequestException('Укажите название материала');
      }
      row.title = title;
    }
    if (dto.description !== undefined) {
      row.description = this.normalizeOptionalText(dto.description);
    }
    if (dto.externalLink !== undefined) {
      row.externalLink = this.normalizeOptionalText(dto.externalLink);
    }
    if (dto.fileUrl !== undefined) {
      row.fileUrl = this.normalizeOptionalText(dto.fileUrl);
    }
    return this.materialRepo.save(row);
  }

  async deleteMaterial(
    actor: JwtPayload,
    tutorId: string,
    materialId: string,
  ): Promise<{ id: string; deleted: true }> {
    await this.tutorAccess.assertCanUpdateTutor(actor, tutorId, {});
    const row = await this.materialRepo.findOne({
      where: { id: materialId, tutorId },
    });
    if (!row) {
      throw new NotFoundException('Материал не найден');
    }
    await this.materialRepo.delete({ id: materialId });
    return { id: materialId, deleted: true };
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
