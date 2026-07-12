import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AttendanceStatus } from '../entities/attendance.entity';

export class UpdateAttendanceDto {
  @IsOptional()
  @IsEnum(['enrolled', 'attended', 'missed', 'missed_no_notice', 'cancelled'])
  attendanceStatus?: AttendanceStatus;

  @IsOptional()
  @IsBoolean()
  balanceDeducted?: boolean;
}
