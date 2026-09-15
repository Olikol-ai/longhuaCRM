import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const USER_REGISTRY_SORT_FIELDS = ['name', 'created_date', 'role', 'status'] as const;
export type UserRegistrySortField = (typeof USER_REGISTRY_SORT_FIELDS)[number];

export class UserRegistryQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  /** Comma-separated account_role keys: admin,teacher,student,sales_manager,pending,user */
  @IsOptional()
  @IsString()
  roles?: string;

  /** Comma-separated user statuses: active,pending,blocked */
  @IsOptional()
  @IsString()
  statuses?: string;

  /** Comma-separated account statuses: active_account,no_account,pending_registration */
  @IsOptional()
  @IsString()
  accountStatuses?: string;

  @IsOptional()
  @IsString()
  createdFrom?: string;

  @IsOptional()
  @IsString()
  createdTo?: string;

  /** Filter students by assigned teacher UUID, or literal `none` for unassigned. */
  @IsOptional()
  @IsString()
  assignedTeacherId?: string;

  @IsOptional()
  @IsEnum(USER_REGISTRY_SORT_FIELDS)
  sort?: UserRegistrySortField;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
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
  @Max(100)
  limit?: number;
}
