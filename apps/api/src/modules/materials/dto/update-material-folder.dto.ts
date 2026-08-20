import { IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Max length aligned with practical folder titles (DB column is text). */
export const MATERIAL_FOLDER_NAME_MAX_LENGTH = 255;

export class UpdateMaterialFolderDto {
  @IsOptional()
  @IsUUID()
  courseTemplateId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MATERIAL_FOLDER_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
