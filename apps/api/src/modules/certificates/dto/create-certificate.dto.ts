import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';
import { CertificateStatus } from '../entities/certificate.entity';

export class CreateCertificateDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  courseId!: string;

  @IsRequiredText()
  registrationNumber!: string;

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
  @IsEnum(['draft', 'issued', 'sent', 'duplicate', 'revoked'])
  status?: CertificateStatus;

  @IsOptional()
  @IsString()
  recipientSignature?: string;
}
