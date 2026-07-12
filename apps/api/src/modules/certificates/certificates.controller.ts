import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { CertificatePdfService } from './certificate-pdf.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { ReissueCertificateDto } from './dto/reissue-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { CertificatesService } from './certificates.service';

@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificatesController {
  constructor(
    private readonly certificatesService: CertificatesService,
    private readonly certificatePdfService: CertificatePdfService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.certificatesService.findAll(user);
  }

  @Post('filter')
  filter(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.certificatesService.filter(user, dto.where ?? {});
  }

  @Get(':id/history')
  findHistory(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.certificatesService.findHistory(user, id);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const certificate = await this.certificatesService.findById(user, id);
    this.certificatesService.assertPdfAllowed(certificate);
    const { buffer, filename } = await this.certificatePdfService.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Get(':id')
  findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.certificatesService.findById(user, id);
  }

  @Post()
  @Roles('admin')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCertificateDto) {
    return this.certificatesService.create(user, dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCertificateDto,
  ) {
    return this.certificatesService.update(user, id, dto);
  }

  @Post(':id/reissue')
  @Roles('admin')
  reissue(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReissueCertificateDto,
  ) {
    return this.certificatesService.reissue(user, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.certificatesService.delete(user, id);
  }
}
