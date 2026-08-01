import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AttendanceStatus } from '../entities/attendance.entity';

/**
 * balanceDeducted is not client-writable (see UpdateAttendanceDto).
 * New rows always start with balanceDeducted=false via entity default.
 */
export class CreateAttendanceDto {
  @IsUUID()
  lessonId!: string;

  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsEnum([
    'enrolled',
    'attended',
    'late',
    'missed',
    'missed_no_notice',
    'excused',
    'cancelled',
  ])
  attendanceStatus?: AttendanceStatus;
}
