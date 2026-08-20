import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { NotificationEntity } from './entities/notification.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { NotificationPreferenceEntity } from './entities/notification-preference.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { WebPushSenderService } from './web-push-sender.service';
import { NotificationDeliveryService } from './notification-delivery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      PushSubscriptionEntity,
      NotificationPreferenceEntity,
      UserEntity,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    NotificationsService,
    PushSubscriptionsService,
    NotificationPreferencesService,
    WebPushSenderService,
    NotificationDeliveryService,
  ],
  exports: [
    NotificationsRepository,
    NotificationsService,
    PushSubscriptionsService,
    NotificationPreferencesService,
    WebPushSenderService,
    NotificationDeliveryService,
    TypeOrmModule,
  ],
})
export class NotificationsModule {}
