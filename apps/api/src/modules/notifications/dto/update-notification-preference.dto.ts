import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsIn([
    'messages',
    'lessons',
    'homework',
    'materials',
    'payments',
    'certificates',
    'exams',
    'system',
  ])
  category!:
    | 'messages'
    | 'lessons'
    | 'homework'
    | 'materials'
    | 'payments'
    | 'certificates'
    | 'exams'
    | 'system';

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  telegramEnabled?: boolean;
}
