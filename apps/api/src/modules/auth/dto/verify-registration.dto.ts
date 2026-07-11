import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyRegistrationDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(4, 12)
  code: string;
}
