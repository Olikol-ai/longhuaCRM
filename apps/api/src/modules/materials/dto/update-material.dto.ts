import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MATERIAL_FILE_TYPES, MaterialFileType } from '../entities/material.entity';
import { DEFAULT_MATERIALS_MAX_UPLOAD_BYTES } from '../../files/material-upload.limits';

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
  @IsIn(MATERIAL_FILE_TYPES)
  fileType?: MaterialFileType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(DEFAULT_MATERIALS_MAX_UPLOAD_BYTES)
  fileSizeBytes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  originalFilename?: string;

  @IsOptional()
  @IsString()
  storedFilename?: string;
}
