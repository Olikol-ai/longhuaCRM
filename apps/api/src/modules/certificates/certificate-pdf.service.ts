import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Repository } from 'typeorm';
import { DOWNLOADABLE_CERTIFICATE_STATUSES } from './certificate-lifecycle';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { CertificateEntity } from './entities/certificate.entity';

export type CertificatePdfPayload = {
  buffer: Buffer;
  filename: string;
  verificationUrl: string;
};

const DISCLAIMER =
  'Данный сертификат не является сертификатом государственного образца и не предоставляет преимуществ, предусмотренных законодательством.';

type FontPair = { regular: string; bold: string };

function resolveCyrillicFonts(): FontPair {
  const candidates: FontPair[] = [
    {
      regular: 'C:\\Windows\\Fonts\\arial.ttf',
      bold: 'C:\\Windows\\Fonts\\arialbd.ttf',
    },
    {
      regular: '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
      bold: '/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf',
    },
    {
      regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    },
    {
      regular: join(process.cwd(), 'assets/fonts/DejaVuSans.ttf'),
      bold: join(process.cwd(), 'assets/fonts/DejaVuSans-Bold.ttf'),
    },
  ];

  for (const pair of candidates) {
    if (existsSync(pair.regular) && existsSync(pair.bold)) {
      return pair;
    }
  }

  throw new BadRequestException(
    'Не найден шрифт с поддержкой кириллицы для PDF сертификата',
  );
}

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
    if (!DOWNLOADABLE_CERTIFICATE_STATUSES.has(certificate.status)) {
      throw new BadRequestException('PDF is not available for this certificate status');
    }

    if (!certificate.studentId) {
      throw new BadRequestException('Certificate has no linked student');
    }

    const [student, course] = await Promise.all([
      this.studentRepo.findOne({ where: { id: certificate.studentId } }),
      this.courseRepo.findOne({ where: { id: certificate.courseId } }),
    ]);

    const studentName =
      student?.name ||
      [student?.lastName, student?.firstName].filter(Boolean).join(' ') ||
      certificate.studentId;
    const courseName = course?.name || certificate.courseId;

    const verificationUrl = this.buildVerificationUrl(certificate.id);
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 140 });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const fonts = resolveCyrillicFonts();

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 48, bottom: 48, left: 48, right: 48 },
        info: {
          Title: `Сертификат ${certificate.registrationNumber}`,
          Author: 'Longhua Chinese',
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('CertRegular', fonts.regular);
      doc.registerFont('CertBold', fonts.bold);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const left = 48;
      const right = pageWidth - 48;
      const width = right - left;

      // Outer decorative frame
      doc
        .lineWidth(2)
        .strokeColor('#b45309')
        .rect(28, 28, pageWidth - 56, pageHeight - 56)
        .stroke();
      doc
        .lineWidth(0.8)
        .strokeColor('#d97706')
        .rect(36, 36, pageWidth - 72, pageHeight - 72)
        .stroke();

      doc.fillColor('#92400e').font('CertRegular').fontSize(11);
      doc.text('LONGHUA CHINESE SCHOOL', left, 70, { width, align: 'center' });

      doc.moveDown(1.2);
      doc.fillColor('#111827').font('CertBold').fontSize(28);
      doc.text('СЕРТИФИКАТ', { align: 'center' });

      doc.moveDown(0.8);
      doc.fillColor('#4b5563').font('CertRegular').fontSize(12);
      doc.text('настоящим подтверждается, что', { align: 'center' });

      doc.moveDown(1);
      doc.fillColor('#312e81').font('CertBold').fontSize(22);
      doc.text(studentName, { align: 'center' });

      doc.moveDown(0.9);
      doc.fillColor('#4b5563').font('CertRegular').fontSize(12);
      doc.text('успешно завершил(а) курс', { align: 'center' });

      doc.moveDown(0.6);
      doc.fillColor('#111827').font('CertBold').fontSize(16);
      doc.text(courseName, { align: 'center' });

      doc.moveDown(1.6);
      const metaY = doc.y;
      const col = width / 3;

      doc.fillColor('#9ca3af').font('CertRegular').fontSize(9);
      doc.text('Серия', left, metaY, { width: col, align: 'center' });
      doc.text('Номер', left + col, metaY, { width: col, align: 'center' });
      doc.text('Дата выдачи', left + col * 2, metaY, { width: col, align: 'center' });

      doc.fillColor('#111827').font('CertBold').fontSize(12);
      doc.text(certificate.blankSeries || '—', left, metaY + 14, {
        width: col,
        align: 'center',
      });
      doc.text(certificate.blankNumber || '—', left + col, metaY + 14, {
        width: col,
        align: 'center',
      });
      doc.text(certificate.issueDate || '—', left + col * 2, metaY + 14, {
        width: col,
        align: 'center',
      });

      doc.moveDown(2.2);
      doc.fillColor('#6b7280').font('CertRegular').fontSize(10);
      doc.text(`Регистрационный номер: ${certificate.registrationNumber}`, {
        align: 'center',
      });

      const qrSize = 88;
      const qrX = pageWidth / 2 - qrSize / 2;
      const qrY = pageHeight - 210;
      doc.image(Buffer.from(qrBase64, 'base64'), qrX, qrY, { width: qrSize });
      doc
        .fillColor('#9ca3af')
        .font('CertRegular')
        .fontSize(8)
        .text('Проверка подлинности', left, qrY + qrSize + 6, {
          width,
          align: 'center',
        });

      doc
        .fillColor('#6b7280')
        .font('CertRegular')
        .fontSize(8)
        .text(DISCLAIMER, left, pageHeight - 72, {
          width,
          align: 'center',
          lineGap: 2,
        });

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
