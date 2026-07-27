import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { TutorAccessService } from '../../common/access/tutor-access.service';
import { JwtPayload } from '../auth/auth.service';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { RoleEntitySyncService } from '../users/role-entity-sync.service';
import { CreateTutorDto } from './dto/create-tutor.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { TutorEntity } from './entities/tutor.entity';
import { TutorDeleteResult, TutorDeletionService } from './tutor-deletion.service';
import { TutorsRepository } from './tutors.repository';

export type TutorStats = {
  tutorId: string;
  studentsCount: number;
  activeStudentsCount: number;
  completedLessonsCount: number;
  teachingMinutes: number;
  upcomingLessonsCount: number;
};

@Injectable()
export class TutorsService {
  constructor(
    private readonly repository: TutorsRepository,
    private readonly tutorAccess: TutorAccessService,
    private readonly tutorDeletion: TutorDeletionService,
    private readonly roleEntitySync: RoleEntitySyncService,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
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

  async getStats(actor: JwtPayload, tutorId?: string): Promise<TutorStats> {
    let id = tutorId;
    if (!id) {
      id = (await this.tutorAccess.resolveTutorId(actor)) ?? undefined;
    }
    if (!id) {
      throw new NotFoundException('Tutor profile not found');
    }
    await this.tutorAccess.assertCanReadTutor(actor, id);

    const students = await this.studentRepo.find({
      where: { assignedTutorId: id },
      select: ['id', 'status'],
    });
    const lessons = await this.lessonRepo.find({
      where: { tutorId: id },
      select: ['id', 'status', 'duration'],
    });

    const completed = lessons.filter((l) => l.status === 'completed');
    const upcoming = lessons.filter((l) => l.status === 'planned');
    const teachingMinutes = completed.reduce(
      (sum, l) => sum + Number(l.duration ?? 60),
      0,
    );

    return {
      tutorId: id,
      studentsCount: students.length,
      activeStudentsCount: students.filter((s) => s.status === 'active').length,
      completedLessonsCount: completed.length,
      teachingMinutes,
      upcomingLessonsCount: upcoming.length,
    };
  }
}
