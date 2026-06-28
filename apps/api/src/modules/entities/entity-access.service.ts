import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  CrudAction,
  getActionScope,
  getEntityPermissions,
} from '../../common/constants/entity-permissions';
import { EntityName } from '../../common/constants/entity-names';
import { normalizeRole } from '../../common/constants/roles';
import { StudentEntity } from '../../entities/Student.entity';
import { TeacherEntity } from '../../entities/Teacher.entity';
import { EntityAccessContext, OwnershipContext } from './entity-access.types';

@Injectable()
export class EntityAccessService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createContext(userId: string | undefined, role: string | undefined): Promise<EntityAccessContext> {
    const normalizedRole = normalizeRole(role);
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const [ownedStudentIds, ownedTeacherId] = await Promise.all([
      this.findOwnedStudentIds(userId),
      this.findOwnedTeacherId(userId),
    ]);
    const assignedStudentIds = await this.findAssignedStudentIds(ownedTeacherId);

    return {
      userId,
      role: normalizedRole,
      ownedStudentIds,
      ownedTeacherId,
      assignedStudentIds,
    };
  }

  createPublicContext(): EntityAccessContext {
    return {
      userId: '',
      role: 'pending',
      ownedStudentIds: [],
      ownedTeacherId: null,
      assignedStudentIds: [],
    };
  }

  createSystemContext(): EntityAccessContext {
    return {
      userId: 'system',
      role: 'admin',
      ownedStudentIds: [],
      ownedTeacherId: null,
      assignedStudentIds: [],
    };
  }

  assertCan(
    entity: EntityName,
    action: CrudAction,
    context: EntityAccessContext,
  ): void {
    const scope = getActionScope(entity, context.role, action);
    if (scope === 'none') {
      throw new ForbiddenException(
        `Forbidden: ${action} on ${entity} is not allowed for role "${context.role}"`,
      );
    }
  }

  filterReadableRecords(
    entity: EntityName,
    context: EntityAccessContext,
    records: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    const scope = getActionScope(entity, context.role, 'read');
    if (scope === 'none') {
      throw new ForbiddenException(
        `Forbidden: read on ${entity} is not allowed for role "${context.role}"`,
      );
    }
    if (scope === 'all') {
      return records;
    }
    return records.filter((record) =>
      this.isOwnRecord(entity, record, context),
    );
  }

  assertCanAccessRecord(
    entity: EntityName,
    action: CrudAction,
    context: EntityAccessContext,
    record: Record<string, unknown>,
  ): void {
    this.assertCan(entity, action, context);
    const scope = getActionScope(entity, context.role, action);
    if (scope === 'own' && !this.isOwnRecord(entity, record, context)) {
      throw new ForbiddenException(
        `Forbidden: ${action} on ${entity} is limited to own records`,
      );
    }
  }

  assertCanCreatePayload(
    entity: EntityName,
    context: EntityAccessContext,
    input: Record<string, unknown>,
  ): void {
    this.assertCan(entity, 'create', context);
    const scope = getEntityPermissions(entity, context.role).create;
    if (scope === 'own' && !this.isOwnCreatePayload(entity, input, context)) {
      throw new ForbiddenException(
        `Forbidden: create on ${entity} is limited to own records`,
      );
    }
  }

  isOwnRecord(
    entity: EntityName,
    record: Record<string, unknown>,
    context: EntityAccessContext | OwnershipContext,
  ): boolean {
    const userId = context.userId;
    const ownedStudentIds = context.ownedStudentIds;
    const assignedStudentIds = context.assignedStudentIds ?? [];
    const ownedTeacherId = context.ownedTeacherId;
    const visibleStudentIds = [...new Set([...ownedStudentIds, ...assignedStudentIds])];

    switch (entity) {
      case 'User':
        return String(record.id) === userId;
      case 'Student': {
        if (String(record.user_id ?? '') === userId) {
          return true;
        }
        return (
          ownedTeacherId != null &&
          String(record.assigned_teacher ?? '') === ownedTeacherId
        );
      }
      case 'Teacher':
        return String(record.user_id ?? '') === userId;
      case 'MaterialAccess':
        return String(record.user_id ?? '') === userId;
      case 'TeacherAvailability':
      case 'TeacherPayment':
      case 'ScheduleSlot':
        return ownedTeacherId != null && String(record.teacher_id ?? '') === ownedTeacherId;
      case 'Payment':
      case 'Course':
        return visibleStudentIds.includes(String(record.student_id ?? ''));
      case 'LessonStudent':
        return visibleStudentIds.includes(String(record.student_id ?? ''));
      case 'Lesson': {
        const studentId = String(record.student_id ?? '');
        if (studentId && visibleStudentIds.includes(studentId)) {
          return true;
        }
        const teacherId = String(record.teacher_id ?? '');
        if (teacherId && ownedTeacherId && teacherId === ownedTeacherId) {
          return true;
        }
        const studentIds = this.parseIdList(record.student_ids);
        return studentIds.some((id) => visibleStudentIds.includes(id));
      }
      default:
        return false;
    }
  }

  private isOwnCreatePayload(
    entity: EntityName,
    input: Record<string, unknown>,
    context: EntityAccessContext,
  ): boolean {
    if (entity === 'TeacherAvailability' && context.ownedTeacherId) {
      const teacherId = String(input.teacher_id ?? input.teacherId ?? '');
      return teacherId === context.ownedTeacherId;
    }
    if ((entity === 'Lesson' || entity === 'ScheduleSlot') && context.ownedTeacherId) {
      const teacherId = String(input.teacher_id ?? input.teacherId ?? '');
      return teacherId === context.ownedTeacherId;
    }
    return this.isOwnRecord(entity, input, context);
  }

  private parseIdList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(String);
    }
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map((part) => part.trim()).filter(Boolean);
    }
    return [];
  }

  private async findOwnedStudentIds(userId: string): Promise<string[]> {
    const rows = await this.dataSource.getRepository(StudentEntity).find({
      where: { userId },
      select: ['id'],
    });
    return rows.map((row) => row.id);
  }

  private async findOwnedTeacherId(userId: string): Promise<string | null> {
    const row = await this.dataSource.getRepository(TeacherEntity).findOne({
      where: { userId },
      select: ['id'],
    });
    return row?.id ?? null;
  }

  private async findAssignedStudentIds(teacherId: string | null): Promise<string[]> {
    if (!teacherId) {
      return [];
    }
    const rows = await this.dataSource.getRepository(StudentEntity).find({
      where: { assignedTeacher: teacherId },
      select: ['id'],
    });
    return rows.map((row) => row.id);
  }
}
