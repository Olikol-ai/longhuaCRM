import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { StudentAccessService } from '../../common/access/student-access.service';
import { JwtPayload } from '../auth/auth.service';
import { RoleEntitySyncService } from '../users/role-entity-sync.service';
import { UsersRepository } from '../users/users.repository';
import { StudentEntity } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentDeleteResult, StudentDeletionService } from './student-deletion.service';
import { StudentsRepository } from './students.repository';

@Injectable()
export class StudentsService {
  constructor(
    private readonly repository: StudentsRepository,
    private readonly studentAccess: StudentAccessService,
    private readonly roleEntitySync: RoleEntitySyncService,
    private readonly usersRepository: UsersRepository,
    private readonly studentDeletion: StudentDeletionService,
  ) {}

  async findAll(actor: JwtPayload): Promise<StudentEntity[]> {
    const where = await this.studentAccess.scopeStudentFilter(actor, {});
    const rows = await this.repository.filter(where as FindOptionsWhere<StudentEntity>);
    return this.applyUserTelegram(rows);
  }

  async findById(actor: JwtPayload, id: string): Promise<StudentEntity> {
    await this.studentAccess.assertCanReadStudent(actor, id);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Student not found');
    }
    const [enriched] = await this.applyUserTelegram([row]);
    return enriched;
  }

  async create(dto: CreateStudentDto): Promise<StudentEntity> {
    const payload: Record<string, unknown> = { ...dto };

    if (dto.email?.trim() && !dto.userId) {
      const user = await this.usersRepository.findByEmail(dto.email.trim().toLowerCase());
      if (user) {
        payload.userId = user.id;
      }
    }

    return this.roleEntitySync.upsertStudentFromCreate(payload);
  }

  async update(actor: JwtPayload, id: string, dto: UpdateStudentDto): Promise<StudentEntity> {
    const payload = await this.studentAccess.assertCanUpdateStudent(
      actor,
      id,
      dto as Record<string, unknown>,
    );

    const normalized: Record<string, unknown> = { ...payload };
    if (
      Object.prototype.hasOwnProperty.call(normalized, 'assignedTeacherId')
      && (normalized.assignedTeacherId === '' || normalized.assignedTeacherId === undefined)
    ) {
      normalized.assignedTeacherId = null;
    }
    if (
      Object.prototype.hasOwnProperty.call(normalized, 'email')
      && typeof normalized.email === 'string'
      && normalized.email.trim() === ''
    ) {
      normalized.email = null;
    }

    const row = await this.repository.update(id, normalized as UpdateStudentDto);
    if (!row) {
      throw new NotFoundException('Student not found');
    }

    const nameTouched =
      normalized.name !== undefined ||
      normalized.firstName !== undefined ||
      normalized.lastName !== undefined;

    if (nameTouched) {
      // Admin-edited `name` is SSOT — re-split first/last so schedule labels stay in sync.
      const nameIsSource = normalized.name !== undefined;
      this.roleEntitySync.normalizeStudentNameFields(row, { nameIsSource });
      const saved = await this.repository.update(id, {
        name: row.name,
        firstName: row.firstName,
        lastName: row.lastName,
      });
      const synced = saved ?? row;
      await this.roleEntitySync.syncLinkedUserFromStudent(synced);
      return synced;
    }

    return row;
  }

  delete(id: string): Promise<StudentDeleteResult> {
    return this.studentDeletion.deleteStudent(id);
  }

  async filter(actor: JwtPayload, where: Record<string, unknown>): Promise<StudentEntity[]> {
    const scoped = await this.studentAccess.scopeStudentFilter(actor, where);
    const rows = await this.repository.filter(scoped as FindOptionsWhere<StudentEntity>);
    return this.applyUserTelegram(rows);
  }

  /** Prefer linked User.telegram_id for API responses (source of truth). */
  private async applyUserTelegram(rows: StudentEntity[]): Promise<StudentEntity[]> {
    const userIds = [
      ...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id))),
    ];
    if (userIds.length === 0) {
      return rows;
    }

    const users = await Promise.all(
      userIds.map((id) => this.usersRepository.findById(id)),
    );
    const byId = new Map(
      users
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map((user) => [user.id, user]),
    );

    for (const row of rows) {
      if (!row.userId) continue;
      const user = byId.get(row.userId);
      const telegramId = (user?.telegramId ?? '').trim();
      if (!telegramId) continue;
      row.telegramId = telegramId;
      row.telegramUsername = (user?.telegramUsername ?? '').trim() || row.telegramUsername;
      row.telegramConnectedAt = user?.telegramConnectedAt ?? row.telegramConnectedAt;
    }
    return rows;
  }
}
