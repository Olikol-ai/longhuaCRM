import {
  IsArray,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SALES_DIARY_CONTACT_TYPES,
  SalesDiaryContactType,
} from '../entities/sales-diary-contact.entity';
import { SALES_DIARY_STATUSES, SalesDiaryStatus } from '../entities/sales-diary-entry.entity';

export class CreateSalesDiaryEntryDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  salesManagerUserId!: string;
}

export class BulkCreateSalesDiaryEntriesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  organizationIds!: string[];

  @IsUUID()
  salesManagerUserId!: string;
}

export class ReassignSalesDiaryEntryDto {
  @IsUUID()
  salesManagerUserId!: string;
}

export class UpdateSalesDiaryEntryDto {
  @IsOptional()
  @IsIn([...SALES_DIARY_STATUSES])
  status?: SalesDiaryStatus;

  @IsOptional()
  @IsString()
  nextContactAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  potentialStudentsCount?: number;
}

export class CreateSalesDiaryNoteDto {
  @IsString()
  @MaxLength(10000)
  note!: string;
}

export class CreateSalesDiaryContactDto {
  @IsIn([...SALES_DIARY_CONTACT_TYPES])
  contactType!: SalesDiaryContactType;

  @IsString()
  contactedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  result?: string;

  @IsOptional()
  @IsString()
  nextContactAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}

export class CreateOrganizationDealDto {
  @IsInt()
  @Min(1)
  studentsCount!: number;

  @IsOptional()
  @IsNumberString()
  pricePerStudent?: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  contractDate?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

export class UpdateOrganizationDealDto {
  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  @IsOptional()
  @IsIn(['signed', 'cancelled'])
  status?: 'signed' | 'cancelled';
}

export class SalesDiaryListFilterDto {
  @IsOptional()
  @IsUUID()
  managerUserId?: string;

  @IsOptional()
  @IsIn(['all', 'today', 'overdue', 'in_work', 'contract_signed', 'refused'])
  filter?: 'all' | 'today' | 'overdue' | 'in_work' | 'contract_signed' | 'refused';

  @IsOptional()
  @IsString()
  search?: string;
}
