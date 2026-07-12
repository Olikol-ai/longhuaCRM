import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { GrantedByRole } from '../entities/material-access.entity';

export class SyncMaterialAccessDto {
  @IsUUID()
  userId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  materialIds!: string[];

  @IsOptional()
  @IsEnum(['ADMIN', 'TEACHER'])
  grantedByRole?: GrantedByRole;
}
