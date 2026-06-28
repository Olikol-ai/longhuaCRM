import { IsString, Length } from 'class-validator';

export class VerifyCodeDto {
  @IsString()
  @Length(4, 12)
  code: string;
}
