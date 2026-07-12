import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { filterToEntityWhere } from '../utils/api-record.util';
import { GroupEntity } from '../../modules/groups/entities/group.entity';
import { TeacherEntity } from '../../modules/teachers/entities/teacher.entity';
import { NO_ACCESS_UUID } from './access.constants';
import { DomainAccessActor, TEACHER_SELF_UPDATE_FIELDS } from './domain-access.types';

@Injectable()
export class TeacherAccessService {
  constructor(
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
  ) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  async resolveTeacherId(actor: DomainAccessActor): Promise<string | null> {
    const row = await this.teacherRepo.findOne({ where: { userId: actor.sub } });
    return row?.id ?? null;
  }

  async scopeTeacherFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    const role = normalizeRole(actor.role);
    if (role === 'student') {
      return filterToEntityWhere(where);
    }

    if (role === 'teacher') {
      return filterToEntityWhere({ ...where, user_id: actor.sub });
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanReadTeacher(actor: DomainAccessActor, teacherId: string): Promise<void> {
    if (this.isAdmin(actor)) {
      return;
    }

    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const role = normalizeRole(actor.role);
    if (role === 'teacher' && teacher.userId === actor.sub) {
      return;
    }

    if (role === 'student') {
      return;
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanUpdateTeacher<T extends Record<string, unknown>>(
    actor: DomainAccessActor,
    teacherId: string,
    dto: T,
  ): Promise<Partial<T>> {
    await this.assertCanReadTeacher(actor, teacherId);

    if (this.isAdmin(actor)) {
      return dto;
    }

    if (normalizeRole(actor.role) === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
      if (!teacher || teacher.userId !== actor.sub) {
        throw new ForbiddenException('Cannot update another teacher profile');
      }
      const payload = this.pickFields(dto, TEACHER_SELF_UPDATE_FIELDS);
      if (payload.userId && payload.userId !== actor.sub) {
        throw new ForbiddenException('Cannot reassign teacher user link');
      }
      return payload;
    }

    throw new ForbiddenException('Forbidden');
  }

  async scopeGroupFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    if (normalizeRole(actor.role) === 'teacher') {
      const teacherId = await this.resolveTeacherId(actor);
      if (!teacherId) {
        return { teacherId: NO_ACCESS_UUID };
      }
      return filterToEntityWhere({ ...where, teacher_id: teacherId });
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanReadGroup(actor: DomainAccessActor, groupId: string): Promise<void> {
    if (this.isAdmin(actor)) {
      return;
    }

    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (normalizeRole(actor.role) === 'teacher') {
      const teacherId = await this.resolveTeacherId(actor);
      if (!teacherId || group.teacherId !== teacherId) {
        throw new ForbiddenException('Cannot access another teacher group');
      }
      return;
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
