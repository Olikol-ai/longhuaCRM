import {
  IsInt,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateAvailabilitySlotDto {
  @IsUUID()
  teacherId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  timeFrom!: string;

  @IsString()
  timeTo!: string;
}
