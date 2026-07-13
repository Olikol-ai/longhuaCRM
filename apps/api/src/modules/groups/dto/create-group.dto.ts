import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';
import { GroupStatus } from '../entities/group.entity';

export class CreateGroupDto {
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsRequiredText()
  name!: string;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'archived'])
  status?: GroupStatus;
}
