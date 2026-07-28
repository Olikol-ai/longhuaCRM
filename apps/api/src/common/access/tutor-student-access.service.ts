import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { TutorStudentEntity } from '../../modules/tutors/entities/tutor-student.entity';
import { TutorEntity } from '../../modules/tutors/entities/tutor.entity';
import { DomainAccessActor } from './domain-access.types';

@Injectable()
export class TutorStudentAccessService {
  constructor(
    @InjectRepository(TutorStudentEntity)
    private readonly tutorStudentRepo: Repository<TutorStudentEntity>,
    @InjectRepository(TutorEntity)
    private readonly tutorRepo: Repository<TutorEntity>,
  ) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  async resolveTutorId(actor: DomainAccessActor): Promise<string | null> {
    const row = await this.tutorRepo.findOne({ where: { userId: actor.sub } });
    return row?.id ?? null;
  }

  async assertCanListForTutor(actor: DomainAccessActor, tutorId: string): Promise<void> {
    if (this.isAdmin(actor)) {
      return;
    }
    if (normalizeRole(actor.role) !== 'tutor') {
      throw new ForbiddenException('Forbidden');
    }
    const ownTutorId = await this.resolveTutorId(actor);
    if (!ownTutorId || ownTutorId !== tutorId) {
      throw new ForbiddenException('Можно видеть только своих учеников');
    }
  }

  async resolveTutorStudentId(actor: DomainAccessActor): Promise<string | null> {
    if (normalizeRole(actor.role) !== 'tutor_student') {
      return null;
    }
    const row = await this.tutorStudentRepo.findOne({ where: { userId: actor.sub } });
    return row?.id ?? null;
  }

  async assertCanReadTutorStudent(
    actor: DomainAccessActor,
    tutorStudentId: string,
  ): Promise<TutorStudentEntity> {
    const row = await this.tutorStudentRepo.findOne({ where: { id: tutorStudentId } });
    if (!row) {
      throw new NotFoundException('Ученик репетитора не найден');
    }
    if (this.isAdmin(actor)) {
      return row;
    }
    if (normalizeRole(actor.role) === 'tutor') {
      const ownTutorId = await this.resolveTutorId(actor);
      if (!ownTutorId || row.tutorId !== ownTutorId) {
        throw new ForbiddenException('Cannot access tutor students outside your assignment');
      }
      return row;
    }
    if (normalizeRole(actor.role) === 'tutor_student') {
      if (row.userId !== actor.sub) {
        throw new ForbiddenException('Cannot access another tutor student profile');
      }
      return row;
    }
    throw new ForbiddenException('Forbidden');
  }

  /** Tutor may create/edit/delete only their own notebook entries. */
  async assertCanWriteTutorStudent(
    actor: DomainAccessActor,
    tutorStudentId: string,
  ): Promise<TutorStudentEntity> {
    if (normalizeRole(actor.role) !== 'tutor' && !this.isAdmin(actor)) {
      throw new ForbiddenException('Forbidden');
    }
    const row = await this.assertCanReadTutorStudent(actor, tutorStudentId);
    if (this.isAdmin(actor)) {
      return row;
    }
    const ownTutorId = await this.resolveTutorId(actor);
    if (!ownTutorId || row.tutorId !== ownTutorId) {
      throw new ForbiddenException('Можно изменять только свои записи учеников');
    }
    return row;
  }
}
