import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayload } from '../auth/auth.service';
import { toDbRole } from '../auth/onboarding';
import { AuditService } from '../audit/audit.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ProfileRelationsService } from './profile-relations.service';
import { RoleEntitySyncService } from './role-entity-sync.service';
import { userToRecord } from './user.mapper';
import { UsersRepository } from './users.repository';
import { UserEntity } from './entities/user.entity';

const BLOCKED_UPDATE_FIELDS = new Set([
  'id',
  'passwordHash',
  'password_hash',
  'email',
  'createdDate',
  'updatedDate',
  'created_date',
  'updated_date',
]);

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly audit: AuditService,
    private readonly roleEntitySync: RoleEntitySyncService,
    private readonly profileRelations: ProfileRelationsService,
  ) {}

  async list(): Promise<Record<string, unknown>[]> {
    const users = await this.usersRepository.findAll();
    return users.map(userToRecord);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: JwtPayload,
  ): Promise<Record<string, unknown>> {
    for (const key of Object.keys(dto)) {
      if (BLOCKED_UPDATE_FIELDS.has(key)) {
        throw new ForbiddenException(`Field "${key}" cannot be updated`);
      }
    }

    const row = await this.usersRepository.findById(id);
    if (!row) {
      throw new NotFoundException('User not found');
    }

    const prevRole = row.role;
    const prevStatus = row.status;

    if (dto.role !== undefined) {
      row.role = toDbRole(String(dto.role));
    }
    if (dto.status !== undefined) {
      row.status = String(dto.status);
    }
    if (dto.firstName !== undefined) {
      row.firstName = String(dto.firstName);
    }
    if (dto.lastName !== undefined) {
      row.lastName = String(dto.lastName);
    }
    if (dto.phone !== undefined) {
      row.phone = String(dto.phone);
    }
    if (dto.telegramId !== undefined) {
      row.telegramId = String(dto.telegramId);
    }

    if (
      dto.role !== undefined &&
      ['admin', 'teacher', 'student'].includes(String(dto.role))
    ) {
      row.status = 'active';
      row.verificationCode = null;
      row.verificationCodeExpiresAt = null;
      row.verificationCodeSentAt = null;
      row.verificationAttempts = 0;
    }

    row.updatedDate = new Date();
    const saved = await this.usersRepository.save(row);

    if (dto.role !== undefined && saved.role !== prevRole) {
      await this.audit.log({
        actorUserId: actor.sub,
        action: 'role_change',
        entityType: 'User',
        entityId: id,
        summary: `role: "${prevRole}" → "${saved.role}"`,
      });
      await this.roleEntitySync.syncAfterRoleChange(saved, saved.role);
    }

    if (dto.status !== undefined && saved.status !== prevStatus) {
      await this.audit.log({
        actorUserId: actor.sub,
        action: 'status_change',
        entityType: 'User',
        entityId: id,
        summary: `status: "${prevStatus}" → "${saved.status}"`,
      });
    }

    return userToRecord(saved);
  }

  async delete(id: string): Promise<{ ok: true; orphanStudents: unknown[] }> {
    const row = await this.usersRepository.findById(id);
    if (!row) {
      throw new NotFoundException('User not found');
    }
    const { orphanStudents } = await this.profileRelations.deleteProfilesForUser(id);
    await this.usersRepository.delete(id);
    return { ok: true, orphanStudents };
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findById(id);
  }
}
