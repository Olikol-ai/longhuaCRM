import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateMaterialFolderDto {
  @IsOptional()
  @IsUUID()
  courseTemplateId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
