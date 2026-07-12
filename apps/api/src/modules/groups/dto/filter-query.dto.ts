import { IsObject, IsOptional } from 'class-validator';

export class FilterQueryDto {
  @IsOptional()
  @IsObject()
  where?: Record<string, unknown>;
}
