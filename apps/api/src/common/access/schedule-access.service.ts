import { ForbiddenException, Injectable } from '@nestjs/common';
import { normalizeRole } from '../constants/roles';
import { filterToEntityWhere } from '../utils/api-record.util';
import { NO_ACCESS_UUID } from './access.constants';
import { DomainAccessActor } from './domain-access.types';
import { TeacherAccessService } from './teacher-access.service';

@Injectable()
export class ScheduleAccessService {
  constructor(private readonly teacherAccess: TeacherAccessService) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return this.teacherAccess.isAdmin(actor);
  }

  async assertCanAccessTeacherSchedule(
    actor: DomainAccessActor,
    teacherId: string,
  ): Promise<void> {
    if (this.isAdmin(actor)) {
      return;
    }

    const role = normalizeRole(actor.role);
    if (role === 'teacher') {
      const ownTeacherId = await this.teacherAccess.resolveTeacherId(actor);
      if (!ownTeacherId || ownTeacherId !== teacherId) {
        throw new ForbiddenException('Cannot access another teacher schedule');
      }
      return;
    }

    if (role === 'student') {
      return;
    }

    throw new ForbiddenException('Forbidden');
  }

  async scopeSlotFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    const role = normalizeRole(actor.role);
    if (role === 'teacher') {
      const teacherId = await this.teacherAccess.resolveTeacherId(actor);
      if (!teacherId) {
        return { teacherId: NO_ACCESS_UUID };
      }
      const scoped = filterToEntityWhere(where);
      if (scoped.teacherId && scoped.teacherId !== teacherId) {
        return { teacherId: NO_ACCESS_UUID };
      }
      return { ...scoped, teacherId };
    }

    throw new ForbiddenException('Forbidden');
  }

  async scopeBookingFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.scopeSlotFilter(actor, where);
  }

  async assertCanReadSlot(actor: DomainAccessActor, teacherId: string): Promise<void> {
    await this.assertCanAccessTeacherSchedule(actor, teacherId);
  }
}
