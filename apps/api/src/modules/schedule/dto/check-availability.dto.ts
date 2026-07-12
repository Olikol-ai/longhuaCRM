import { IsInt, IsOptional, IsString } from 'class-validator';

export class CheckAvailabilityDto {
  @IsString()
  date!: string;

  @IsOptional()
  @IsString()
  start_time?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsInt()
  duration?: number;
}
