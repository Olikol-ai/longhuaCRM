import { IsEnum, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
import { GroupStatus } from '../entities/group.entity';

export class UpdateGroupDto {
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'archived'])
  status?: GroupStatus;

  @IsOptional()
  @IsUUID()
  organizationId?: string | null;

  @IsOptional()
  @IsNumberString()
  contractAmount?: string | null;

  @IsOptional()
  @IsString()
  contractCurrency?: string;
}
