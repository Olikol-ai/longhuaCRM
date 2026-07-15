import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { normalizeRole } from '../../common/constants/roles';
import { JwtPayload } from '../auth/auth.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    if (normalizeRole(user.role) === 'admin') {
      return this.notificationsService.findAll();
    }
    return this.notificationsService.filter({ userId: user.sub });
  }

  @Post('filter')
  filter(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    if (normalizeRole(user.role) === 'admin') {
      return this.notificationsService.filter(dto.where ?? {});
    }
    return this.notificationsService.filter({
      ...(dto.where ?? {}),
      userId: user.sub,
    });
  }

  @Get(':id')
  async findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const row = await this.notificationsService.findById(id);
    if (normalizeRole(user.role) !== 'admin' && row.userId !== user.sub) {
      throw new ForbiddenException('Forbidden');
    }
    return row;
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationDto,
  ) {
    const row = await this.notificationsService.findById(id);
    const role = normalizeRole(user.role);
    if (role === 'admin') {
      return this.notificationsService.update(id, dto);
    }
    // Students/teachers may only mark their own notifications as read.
    if (row.userId !== user.sub) {
      throw new ForbiddenException('Forbidden');
    }
    if (dto.status !== 'read') {
      throw new ForbiddenException('Only marking as read is allowed');
    }
    return this.notificationsService.update(id, { status: 'read' });
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: string) {
    return this.notificationsService.delete(id);
  }
}
