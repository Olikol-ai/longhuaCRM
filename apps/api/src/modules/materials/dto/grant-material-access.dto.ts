import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { GrantedByRole } from '../entities/material-access.entity';

export type MaterialAccessTargetType = 'user' | 'student' | 'group' | 'course';

export class GrantMaterialAccessDto {
  @IsArray()
  @IsUUID('4', { each: true })
  materialIds!: string[];

  @IsEnum(['user', 'student', 'group', 'course'])
  targetType!: MaterialAccessTargetType;

  @IsUUID()
  targetId!: string;

  @IsOptional()
  @IsEnum(['ADMIN', 'TEACHER'])
  grantedByRole?: GrantedByRole;
}

export class RevokeMaterialAccessDto {
  @IsArray()
  @IsUUID('4', { each: true })
  materialIds!: string[];

  @IsEnum(['user', 'student', 'group', 'course'])
  targetType!: MaterialAccessTargetType;

  @IsUUID()
  targetId!: string;
}
