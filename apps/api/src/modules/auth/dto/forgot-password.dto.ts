import { IsEmail, IsString, MinLength } from 'class-validator';
import { IsRegistrationPassword } from '../../../common/validators/is-registration-password.decorator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token: string;

  /** Strength rules: see common/security/password-validation.ts */
  @IsString()
  @IsRegistrationPassword()
  password: string;

  @IsString()
  @MinLength(1)
  confirm_password: string;
}
