import { IsEnum, IsNumberString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { OrganizationStatus } from '../entities/organization.entity';

export class CreateOrganizationDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unp?: string;

  @IsOptional()
  @IsUUID()
  salesManagerUserId?: string;

  @IsOptional()
  @IsEnum(['active', 'archived'])
  status?: OrganizationStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unp?: string;

  @IsOptional()
  @IsUUID()
  salesManagerUserId?: string | null;

  @IsOptional()
  @IsEnum(['active', 'archived'])
  status?: OrganizationStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrganizationReceiptDto {
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  receivedAt?: string;

  @IsOptional()
  @IsEnum(['pending', 'received', 'cancelled'])
  status?: 'pending' | 'received' | 'cancelled';

  @IsOptional()
  @IsString()
  purpose?: string;
}

export class CreateCommissionPayoutDto {
  @IsUUID()
  managerUserId!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Optional explicit accrual ids to mark paid; otherwise FIFO by created_at. */
  @IsOptional()
  @IsUUID(undefined, { each: true })
  accrualIds?: string[];
}

export class UpdateSalesManagerProfileDto {
  @IsNumberString()
  commissionPercent!: string;
}

export class B2bDashboardFilterDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsEnum(['pending', 'received', 'cancelled'])
  receiptStatus?: 'pending' | 'received' | 'cancelled';
}
