import { Controller, Get, Param } from '@nestjs/common';
import { CertificatesService } from './certificates.service';

/** Public QR verification — intentionally without JWT guards. */
@Controller('certificates')
export class CertificateVerificationController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get(':id/verify')
  verify(@Param('id') id: string) {
    return this.certificatesService.verifyPublic(id);
  }
}
