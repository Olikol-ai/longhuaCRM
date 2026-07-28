import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';

export class CreateTutorMaterialDto {
  @IsRequiredText()
  @MaxLength(200)
  title!: string;

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
