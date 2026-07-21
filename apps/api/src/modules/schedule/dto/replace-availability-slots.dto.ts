import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class AvailabilitySlotItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  day!: number;

  @IsString()
  @Matches(/^\d{1,2}:\d{2}(:\d{2})?$/, { message: 'from must be HH:MM' })
  from!: string;

  @IsString()
  @Matches(/^\d{1,2}:\d{2}(:\d{2})?$/, { message: 'to must be HH:MM' })
  to!: string;
}

export class ReplaceAvailabilitySlotsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotItemDto)
  slots!: AvailabilitySlotItemDto[];
}
