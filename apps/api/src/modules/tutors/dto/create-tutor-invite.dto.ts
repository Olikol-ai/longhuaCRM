import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTutorInviteDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}
