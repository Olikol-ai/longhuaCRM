import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';

/** Personal notebook entry for a tutor — not a school CRM Student. */
export class CreateTutorStudentNotebookDto {
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
  notes?: string | null;

  /** Alias accepted from Russian UI (“комментарий”). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}
