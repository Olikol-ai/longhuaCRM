import { IsEnum, IsOptional } from 'class-validator';
import { AttendanceStatus } from '../entities/attendance.entity';

/**
 * balanceDeducted is server-owned idempotency state for lesson charging.
 * Clients must never set it — StudentBalanceService flips the flag atomically.
 */
export class UpdateAttendanceDto {
  @IsOptional()
  @IsEnum(['enrolled', 'attended', 'missed', 'missed_no_notice', 'cancelled'])
  attendanceStatus?: AttendanceStatus;
}
