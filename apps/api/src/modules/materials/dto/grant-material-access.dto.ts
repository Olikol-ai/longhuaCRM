import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { GrantedByRole } from '../entities/material-access.entity';

export type MaterialAccessTargetType =
  | 'user'
  | 'student'
  | 'tutor_student'
  | 'group'
  | 'course';

export class GrantMaterialAccessDto {
  @IsArray()
  @IsUUID('4', { each: true })
  materialIds!: string[];

  @IsEnum(['user', 'student', 'tutor_student', 'group', 'course'])
  targetType!: MaterialAccessTargetType;

  @IsUUID()
  targetId!: string;

  @IsOptional()
  @IsEnum(['ADMIN', 'TEACHER', 'TUTOR'])
  grantedByRole?: GrantedByRole;
}

export class RevokeMaterialAccessDto {
  @IsArray()
  @IsUUID('4', { each: true })
  materialIds!: string[];

  @IsEnum(['user', 'student', 'tutor_student', 'group', 'course'])
  targetType!: MaterialAccessTargetType;

  @IsUUID()
  targetId!: string;
}
