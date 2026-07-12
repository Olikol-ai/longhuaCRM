import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AttendanceStatus } from '../entities/attendance.entity';

export class CreateAttendanceDto {
  @IsUUID()
  lessonId!: string;

  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsEnum(['enrolled', 'attended', 'missed', 'missed_no_notice', 'cancelled'])
  attendanceStatus?: AttendanceStatus;

  @IsOptional()
  balanceDeducted?: boolean;
}
