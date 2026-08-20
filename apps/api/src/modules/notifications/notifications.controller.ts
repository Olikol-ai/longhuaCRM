import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
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
import { UpsertPushSubscriptionDto } from './dto/upsert-push-subscription.dto';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { NotificationsService } from './notifications.service';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { WebPushSenderService } from './web-push-sender.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushSubscriptions: PushSubscriptionsService,
    private readonly preferences: NotificationPreferencesService,
    private readonly webPush: WebPushSenderService,
  ) {}

  @Get('vapid-public-key')
  vapidPublicKey() {
    return {
      publicKey: this.webPush.getPublicKey(),
      configured: this.webPush.isConfigured(),
      // Human-readable config hint only — never include private key material.
      error: this.webPush.isConfigured() ? null : this.webPush.getConfigError(),
    };
  }

  @Get('feed')
  async feed(@CurrentUser() user: JwtPayload) {
    const items = await this.notificationsService.listForUser(user.sub);
    const unreadCount = await this.notificationsService.unreadCount(user.sub);
    return { items, unreadCount };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: JwtPayload) {
    const unreadCount = await this.notificationsService.unreadCount(user.sub);
    return { unreadCount };
  }

  @Post('mark-all-read')
  async markAllRead(@CurrentUser() user: JwtPayload) {
    const updated = await this.notificationsService.markAllRead(user.sub);
    return { updated };
  }

  @Get('push-subscriptions')
  listPush(@CurrentUser() user: JwtPayload) {
    return this.pushSubscriptions.listActiveForUser(user.sub);
  }

  @Post('push-subscriptions')
  upsertPush(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertPushSubscriptionDto,
    @Req() req: { headers?: { 'user-agent'?: string } },
  ) {
    return this.pushSubscriptions.upsert({
      userId: user.sub,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      deviceLabel: dto.deviceLabel || null,
      userAgent: req.headers?.['user-agent'] || null,
    });
  }

  /**
   * Device-scoped logout revoke. Query param preferred (DELETE bodies are unreliable).
   * Does not revoke other devices for the same user.
   */
  @Delete('push-subscriptions/by-endpoint')
  async revokePushByEndpoint(
    @CurrentUser() user: JwtPayload,
    @Query('endpoint') endpoint?: string,
  ) {
    await this.pushSubscriptions.revokeEndpointForUser(user.sub, endpoint || '');
    return { ok: true };
  }

  @Delete('push-subscriptions/:id')
  async revokePush(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.pushSubscriptions.revokeByIdForUser(id, user.sub);
    return { ok: true };
  }

  @Get('preferences')
  listPreferences(@CurrentUser() user: JwtPayload) {
    return this.preferences.listForUser(user.sub);
  }

  @Patch('preferences')
  updatePreference(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.preferences.upsert(user.sub, dto.category, {
      pushEnabled: dto.pushEnabled,
      inAppEnabled: dto.inAppEnabled,
      telegramEnabled: dto.telegramEnabled,
    });
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    if (normalizeRole(user.role) === 'admin') {
      return this.notificationsService.findAll();
    }
    return this.notificationsService.listForUser(user.sub);
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
