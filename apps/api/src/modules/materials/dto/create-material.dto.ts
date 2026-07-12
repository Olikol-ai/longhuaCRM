import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { MaterialFileType } from '../entities/material.entity';

export class CreateMaterialDto {
  @IsUUID()
  folderId!: string;

  @IsString()
  title!: string;

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
