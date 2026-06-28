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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { USER_BLOCKED_UPDATE_FIELDS } from '../../common/constants/entity-registry';
import { recordToEntityPayload } from '../../common/utils/record.util';
import { UsersRepository } from './users.repository';
import { userToRecord } from './user.mapper';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly usersRepository: UsersRepository) {}

  @Get()
  async list() {
    const users = await this.usersRepository.findAll();
    return users.map(userToRecord);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() input: Record<string, unknown>) {
    for (const key of Object.keys(input)) {
      if (USER_BLOCKED_UPDATE_FIELDS.has(key)) {
        throw new ForbiddenException(`Field "${key}" cannot be updated`);
      }
    }

    const row = await this.usersRepository.findById(id);
    if (!row) throw new NotFoundException('User not found');

    const payload = recordToEntityPayload(input);
    if (payload.role !== undefined) row.role = String(payload.role);
    if (payload.firstName !== undefined) row.firstName = String(payload.firstName);
    if (payload.lastName !== undefined) row.lastName = String(payload.lastName);
    if (payload.phone !== undefined) row.phone = String(payload.phone);
    if (payload.telegramId !== undefined) row.telegramId = String(payload.telegramId);

    row.updatedDate = new Date();
    const saved = await this.usersRepository.save(row);
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
