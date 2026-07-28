import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Update fields for a tutor notebook entry. */
export class UpdateTutorStudentNotebookDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}
