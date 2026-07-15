import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsRegistrationPassword } from '../../../common/validators/is-registration-password.decorator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

function toStrictBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export class RegisterDto {
  @IsEmail()
  email: string;

  /** Strength rules: see common/security/password-validation.ts */
  @IsString()
  @IsRegistrationPassword()
  password: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /**
   * Soft intent only. Backend may assign student role after email verification.
   * Never accept role / roleId / roles[] from the client for privilege assignment.
   */
  @IsOptional()
  @Transform(({ value, obj }) => {
    const record = obj as Record<string, unknown>;
    return toStrictBoolean(value ?? record.wants_student_role);
  })
  @IsBoolean()
  wantsStudentRole?: boolean;

  /**
   * Opaque invite token from /register?ref=… Resolved server-side to teacher_id.
   * Never accept teacherId / assignedTeacherId from the client.
   */
  @IsOptional()
  @Transform(({ value, obj }) => {
    const record = obj as Record<string, unknown>;
    const raw = value ?? record.invite_token;
    return typeof raw === 'string' ? raw.trim() : raw;
  })
  @IsString()
  inviteToken?: string;
}
