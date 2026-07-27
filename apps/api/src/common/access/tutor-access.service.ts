import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { filterToEntityWhere } from '../utils/api-record.util';
import { TutorEntity } from '../../modules/tutors/entities/tutor.entity';
import { DomainAccessActor, TUTOR_SELF_UPDATE_FIELDS } from './domain-access.types';

@Injectable()
export class TutorAccessService {
  constructor(
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

  async scopeTutorFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    if (normalizeRole(actor.role) === 'tutor') {
      return filterToEntityWhere({ ...where, user_id: actor.sub });
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanReadTutor(actor: DomainAccessActor, tutorId: string): Promise<void> {
    if (this.isAdmin(actor)) {
      return;
    }

    const tutor = await this.tutorRepo.findOne({ where: { id: tutorId } });
    if (!tutor) {
      throw new NotFoundException('Tutor not found');
    }

    if (normalizeRole(actor.role) === 'tutor' && tutor.userId === actor.sub) {
      return;
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanUpdateTutor<T extends Record<string, unknown>>(
    actor: DomainAccessActor,
    tutorId: string,
    dto: T,
  ): Promise<Partial<T>> {
    await this.assertCanReadTutor(actor, tutorId);

    if (this.isAdmin(actor)) {
      return dto;
    }

    if (normalizeRole(actor.role) === 'tutor') {
      return this.pickFields(dto, TUTOR_SELF_UPDATE_FIELDS);
    }

    throw new ForbiddenException('Forbidden');
  }

  private pickFields<T extends Record<string, unknown>>(
    dto: T,
    allowed: readonly string[],
  ): Partial<T> {
    const out: Partial<T> = {};
    for (const key of allowed) {
      if (dto[key as keyof T] !== undefined) {
        out[key as keyof T] = dto[key as keyof T];
      }
    }
    return out;
  }
}
