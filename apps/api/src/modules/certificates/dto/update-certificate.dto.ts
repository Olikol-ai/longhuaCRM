import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CertificateStatus } from '../entities/certificate.entity';

export class UpdateCertificateDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  blankSeries?: string;

  @IsOptional()
  @IsString()
  blankNumber?: string;

  @IsOptional()
  @IsString()
  issueDate?: string;

  @IsOptional()
  @IsEnum(['draft', 'issued', 'revoked'])
  status?: CertificateStatus;

  @IsOptional()
  @IsString()
  recipientSignature?: string;
}
