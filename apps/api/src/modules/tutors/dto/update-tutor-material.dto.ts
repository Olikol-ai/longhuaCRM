import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTutorMaterialDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  externalLink?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fileUrl?: string | null;
}
