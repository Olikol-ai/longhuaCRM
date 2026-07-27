import { IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * Self-service profile update for the authenticated user only.
 * Role / status / permissions are not accepted (role is explicitly rejected in service).
 */
export class UpdateMeDto {
  /** Optional single FIO field; split into last_name + first_name on the server. */
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /** Rejected in AuthService — role changes are admin-only. */
  @IsOptional()
  @IsString()
  role?: string;
}
