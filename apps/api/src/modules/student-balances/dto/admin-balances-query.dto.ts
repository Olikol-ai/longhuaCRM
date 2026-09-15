import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

function toStrictBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

export class AdminBalancesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  debtorsOnly?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  positiveBalanceOnly?: boolean;

  @IsOptional()
  @IsIn(['name', 'debt', 'overpayment', 'conducted', 'lesson_balance', 'paid'])
  sort?: 'name' | 'debt' | 'overpayment' | 'conducted' | 'lesson_balance' | 'paid';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

/** Transform query-string booleans for Nest ValidationPipe. */
export function normalizeAdminBalancesQuery(
  raw: Record<string, unknown>,
): AdminBalancesQueryDto {
  const dto = new AdminBalancesQueryDto();
  if (typeof raw.search === 'string') dto.search = raw.search;
  if (typeof raw.teacherId === 'string') dto.teacherId = raw.teacherId;
  if (typeof raw.groupId === 'string') dto.groupId = raw.groupId;
  const debtors = toStrictBoolean(raw.debtorsOnly);
  if (debtors !== undefined) dto.debtorsOnly = debtors;
  const positive = toStrictBoolean(raw.positiveBalanceOnly);
  if (positive !== undefined) dto.positiveBalanceOnly = positive;
  if (
    raw.sort === 'name'
    || raw.sort === 'debt'
    || raw.sort === 'overpayment'
    || raw.sort === 'conducted'
    || raw.sort === 'lesson_balance'
    || raw.sort === 'paid'
  ) {
    dto.sort = raw.sort;
  }
  if (raw.sortDir === 'asc' || raw.sortDir === 'desc') {
    dto.sortDir = raw.sortDir;
  }
  if (raw.page != null && raw.page !== '') dto.page = Number(raw.page);
  if (raw.limit != null && raw.limit !== '') dto.limit = Number(raw.limit);
  return dto;
}
