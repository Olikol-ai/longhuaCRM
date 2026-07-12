import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationChannel, NotificationStatus } from '../entities/notification.entity';

export class UpdateNotificationDto {
  @IsOptional()
  @IsEnum(['telegram', 'email', 'in_app'])
  channel?: NotificationChannel;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsEnum(['pending', 'sent', 'failed', 'read'])
  status?: NotificationStatus;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}
