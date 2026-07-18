import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export function paginateArray<T>(
  items: T[],
  limit?: number,
  offset?: number,
): { items: T[]; total: number } {
  const total = items.length;
  const start = offset ?? 0;
  const end = limit != null ? start + limit : undefined;
  return { items: items.slice(start, end), total };
}
