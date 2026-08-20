import { IsString, MinLength } from 'class-validator';
import { IsRegistrationPassword } from '../../../common/validators/is-registration-password.decorator';

/**
 * Authenticated user changes their own password (current password required).
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  current_password: string;

  /** Strength rules: see common/security/password-validation.ts */
  @IsString()
  @IsRegistrationPassword()
  new_password: string;

  @IsString()
  @MinLength(1)
  confirm_password: string;
}
