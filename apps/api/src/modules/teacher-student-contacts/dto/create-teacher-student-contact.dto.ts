import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';

export class CreateTeacherStudentContactDto {
  @IsRequiredText()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;

  /** Alias from UI («комментарий»). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
