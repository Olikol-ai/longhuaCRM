import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMaterialFolderDto {
  @IsOptional()
  @IsUUID()
  courseTemplateId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
