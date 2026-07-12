import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { MaterialFileType } from '../entities/material.entity';

export class UpdateMaterialDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsEnum(['pdf', 'pptx', 'video', 'link', 'other'])
  fileType?: MaterialFileType;

  @IsOptional()
  @IsString()
  description?: string;
}
