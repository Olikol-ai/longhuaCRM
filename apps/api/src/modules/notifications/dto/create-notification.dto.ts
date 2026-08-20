import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NotificationChannel, NotificationStatus } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsUUID()
  userId!: string;

  @IsEnum(['telegram', 'email', 'in_app', 'web_push'])
  channel!: NotificationChannel;

  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsEnum(['pending', 'sent', 'failed', 'read'])
  status?: NotificationStatus;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  deepLink?: string;
}
