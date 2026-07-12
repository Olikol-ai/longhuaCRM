import { IsOptional, IsString } from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';

export class ReissueCertificateDto {
  @IsRequiredText()
  registrationNumber!: string;

  @IsRequiredText()
  blankSeries!: string;

  @IsRequiredText()
  blankNumber!: string;

  @IsOptional()
  @IsString()
  issueDate?: string;
}
