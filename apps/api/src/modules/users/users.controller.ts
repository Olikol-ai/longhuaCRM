import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { USER_BLOCKED_UPDATE_FIELDS } from '../../common/constants/entity-registry';
import { recordToEntityPayload } from '../../common/utils/record.util';
import { JwtPayload } from '../auth/auth.service';
import { toDbRole } from '../auth/onboarding';
import { AuditService } from '../audit/audit.service';
import { RoleEntitySyncService } from './role-entity-sync.service';
import { UsersRepository } from './users.repository';
import { userToRecord } from './user.mapper';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly audit: AuditService,
    private readonly roleEntitySync: RoleEntitySyncService,
  ) {}

  @Get()
  async list() {
    const users = await this.usersRepository.findAll();
    return users.map(userToRecord);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() input: Record<string, unknown>,
    @CurrentUser() actor: JwtPayload,
  ) {
    for (const key of Object.keys(input)) {
      if (USER_BLOCKED_UPDATE_FIELDS.has(key)) {
        throw new ForbiddenException(`Field "${key}" cannot be updated`);
      }
    }

    const row = await this.usersRepository.findById(id);
    if (!row) throw new NotFoundException('User not found');

    const prevRole = row.role;
    const prevStatus = row.status;

    const payload = recordToEntityPayload(input);
    if (payload.role !== undefined) {
      row.role = toDbRole(String(payload.role));
    }
    if (payload.status !== undefined) row.status = String(payload.status);
    if (payload.firstName !== undefined) row.firstName = String(payload.firstName);
    if (payload.lastName !== undefined) row.lastName = String(payload.lastName);
    if (payload.phone !== undefined) row.phone = String(payload.phone);
    if (payload.telegramId !== undefined) row.telegramId = String(payload.telegramId);

    if (
      payload.role !== undefined &&
      ['admin', 'teacher', 'student'].includes(String(payload.role))
    ) {
      row.status = 'active';
      row.verificationCode = null;
      row.verificationAttempts = 0;
    }

    row.updatedDate = new Date();
    const saved = await this.usersRepository.save(row);

    if (payload.role !== undefined && saved.role !== prevRole) {
      await this.audit.log({
        actorUserId: actor.sub,
        action: 'role_change',
        entityType: 'User',
        entityId: id,
        summary: `role: "${prevRole}" → "${saved.role}"`,
      });
      await this.roleEntitySync.syncAfterRoleChange(saved, saved.role);
    }

    if (payload.status !== undefined && saved.status !== prevStatus) {
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

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const row = await this.usersRepository.findById(id);
    if (!row) throw new NotFoundException('User not found');
    await this.usersRepository.delete(id);
    return { ok: true };
  }
}
