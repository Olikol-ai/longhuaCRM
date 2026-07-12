import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Repository } from 'typeorm';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { CertificateEntity } from './entities/certificate.entity';

export type CertificatePdfPayload = {
  buffer: Buffer;
  filename: string;
  verificationUrl: string;
};

@Injectable()
export class CertificatePdfService {
  constructor(
    @InjectRepository(CertificateEntity)
    private readonly certificateRepo: Repository<CertificateEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(CourseTemplateEntity)
    private readonly courseRepo: Repository<CourseTemplateEntity>,
    private readonly config: ConfigService,
  ) {}

  async generatePdf(certificateId: string): Promise<CertificatePdfPayload> {
    const certificate = await this.certificateRepo.findOne({ where: { id: certificateId } });
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    const [student, course] = await Promise.all([
      this.studentRepo.findOne({ where: { id: certificate.studentId } }),
      this.courseRepo.findOne({ where: { id: certificate.courseId } }),
    ]);

    const verificationUrl = this.buildVerificationUrl(certificate.id);
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 128 });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(22).text('Longhua CRM — Certificate', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Student: ${student?.name ?? certificate.studentId}`);
      doc.text(`Course: ${course?.name ?? certificate.courseId}`);
      doc.text(`Registration number: ${certificate.registrationNumber}`);
      doc.text(`Blank series: ${certificate.blankSeries ?? '—'}`);
      doc.text(`Blank number: ${certificate.blankNumber ?? '—'}`);
      doc.text(`Issue date: ${certificate.issueDate ?? '—'}`);
      doc.text(`Status: ${certificate.status}`);
      doc.moveDown();

      doc.fontSize(10).fillColor('#555').text('QR verification (future endpoint):', { underline: true });
      doc.fillColor('#000').text(verificationUrl);
      doc.image(Buffer.from(qrBase64, 'base64'), doc.x, doc.y + 8, { width: 96 });

      doc.end();
    });

    return {
      buffer,
      filename: `certificate-${certificate.registrationNumber}.pdf`,
      verificationUrl,
    };
  }

  private buildVerificationUrl(certificateId: string): string {
    const base =
      this.config.get<string>('appPublicUrl')?.replace(/\/$/, '') ??
      `http://localhost:${this.config.get<number>('port') ?? 3001}`;
    return `${base}/api/certificates/${certificateId}/verify`;
  }
}
