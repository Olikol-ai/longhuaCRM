import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTeacherInviteDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}
