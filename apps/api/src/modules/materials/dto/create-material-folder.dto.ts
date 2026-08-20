import { IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MATERIAL_FOLDER_NAME_MAX_LENGTH } from './update-material-folder.dto';

export class CreateMaterialFolderDto {
  @IsOptional()
  @IsUUID()
  courseTemplateId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @MaxLength(MATERIAL_FOLDER_NAME_MAX_LENGTH)
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
