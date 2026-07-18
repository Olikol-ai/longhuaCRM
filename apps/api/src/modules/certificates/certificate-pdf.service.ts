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

/** Palette tuned to the Longhua Chinese parchment template. */
const COLORS = {
  ink: '#2a1710',
  muted: '#6b4a3a',
  soft: '#8a6a58',
  accent: '#9b1c1c',
  seal: '#b91c1c',
  paperTint: '#f7efe3',
  qrLight: '#fffdf8',
};

type FontPair = { regular: string; bold: string };

function resolveCyrillicFonts(): FontPair {
  const candidates: FontPair[] = [
    {
      regular: 'C:\\Windows\\Fonts\\times.ttf',
      bold: 'C:\\Windows\\Fonts\\timesbd.ttf',
    },
    {
      regular: 'C:\\Windows\\Fonts\\georgia.ttf',
      bold: 'C:\\Windows\\Fonts\\georgiab.ttf',
    },
    {
      regular: 'C:\\Windows\\Fonts\\arial.ttf',
      bold: 'C:\\Windows\\Fonts\\arialbd.ttf',
    },
    {
      regular: 'C:\\Windows\\Fonts\\segoeui.ttf',
      bold: 'C:\\Windows\\Fonts\\segoeuib.ttf',
    },
    {
      regular: '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
      bold: '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
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

function resolveCertificateBackground(): string {
  const candidates = [
    // Compiled Nest output: dist/modules/certificates → dist/assets/...
    join(__dirname, '../../assets/certificates/certificate-bg.png'),
    // Source tree while developing / tests
    join(__dirname, '../../../src/assets/certificates/certificate-bg.png'),
    join(process.cwd(), 'src/assets/certificates/certificate-bg.png'),
    join(process.cwd(), 'apps/api/src/assets/certificates/certificate-bg.png'),
    join(process.cwd(), 'assets/certificates/certificate-bg.png'),
    join(process.cwd(), 'apps/api/assets/certificates/certificate-bg.png'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new BadRequestException('Не найден файл основы сертификата (certificate-bg.png)');
}

function formatIssueDate(value: string | null | undefined): string {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}.${m}.${y}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(parsed.getDate())}.${pad(parsed.getMonth() + 1)}.${parsed.getFullYear()}`;
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
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 180,
      color: { dark: COLORS.ink, light: COLORS.qrLight },
      errorCorrectionLevel: 'M',
    });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const fonts = resolveCyrillicFonts();
    const backgroundPath = resolveCertificateBackground();

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
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

      // Template already has border, seal and landscape — use full page as canvas.
      doc.image(backgroundPath, 0, 0, {
        width: pageWidth,
        height: pageHeight,
      });

      const contentLeft = 72;
      const contentWidth = pageWidth - contentLeft * 2;

      // School name under the red seal (seal itself is in the artwork).
      let y = 168;
      doc
        .fillColor(COLORS.accent)
        .font('CertBold')
        .fontSize(12)
        .text('LONGHUA CHINESE', contentLeft, y, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 4,
        });

      y += 22;
      doc
        .fillColor(COLORS.soft)
        .font('CertRegular')
        .fontSize(9)
        .text('Школа китайского языка', contentLeft, y, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 1.2,
        });

      y += 46;
      doc
        .fillColor(COLORS.ink)
        .font('CertBold')
        .fontSize(36)
        .text('СЕРТИФИКАТ', contentLeft, y, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 5,
        });

      y += 52;
      this.drawOrnament(doc, pageWidth / 2, y);

      y += 28;
      doc
        .fillColor(COLORS.muted)
        .font('CertRegular')
        .fontSize(12)
        .text('настоящим подтверждается, что', contentLeft, y, {
          width: contentWidth,
          align: 'center',
        });

      y += 34;
      doc
        .fillColor(COLORS.ink)
        .font('CertBold')
        .fontSize(studentName.length > 28 ? 20 : 24)
        .text(studentName, contentLeft + 8, y, {
          width: contentWidth - 16,
          align: 'center',
        });

      // Soft underline under the name
      const nameBottom = doc.y + 6;
      doc
        .moveTo(pageWidth / 2 - 110, nameBottom)
        .lineTo(pageWidth / 2 + 110, nameBottom)
        .lineWidth(0.8)
        .strokeColor(COLORS.accent)
        .stroke();

      y = nameBottom + 22;
      doc
        .fillColor(COLORS.muted)
        .font('CertRegular')
        .fontSize(12)
        .text('успешно завершил(а) курс', contentLeft, y, {
          width: contentWidth,
          align: 'center',
        });

      y += 28;
      doc
        .fillColor(COLORS.ink)
        .font('CertBold')
        .fontSize(courseName.length > 42 ? 13 : 15)
        .text(`«${courseName}»`, contentLeft + 12, y, {
          width: contentWidth - 24,
          align: 'center',
        });

      y += 40;
      this.drawOrnament(doc, pageWidth / 2, y);

      const issueDate = formatIssueDate(certificate.issueDate);
      const metaBlockTop = Math.min(y + 34, 470);
      const metaLines = [
        `Серия бланка: ${certificate.blankSeries || '—'}    ·    № бланка: ${certificate.blankNumber || '—'}`,
        `Дата выдачи: ${issueDate}`,
        `Регистрационный номер: ${certificate.registrationNumber || '—'}`,
      ];

      let metaY = metaBlockTop;
      for (const line of metaLines) {
        doc
          .fillColor(COLORS.muted)
          .font('CertRegular')
          .fontSize(10)
          .text(line, contentLeft, metaY, {
            width: contentWidth,
            align: 'center',
          });
        metaY += 18;
      }

      // QR + authenticity note + director signature — kept above the landscape art.
      const footerTop = 575;
      const qrSize = 78;
      const qrX = contentLeft + 6;
      const qrY = footerTop;

      doc
        .roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 6)
        .fill(COLORS.qrLight);
      doc
        .roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 6)
        .lineWidth(0.8)
        .strokeColor(COLORS.accent)
        .stroke();
      doc.image(Buffer.from(qrBase64, 'base64'), qrX, qrY, { width: qrSize });

      doc
        .fillColor(COLORS.soft)
        .font('CertRegular')
        .fontSize(7.5)
        .text('Проверка по QR-коду', qrX - 8, qrY + qrSize + 10, {
          width: qrSize + 16,
          align: 'center',
        });

      const signX = qrX + qrSize + 36;
      const signWidth = contentLeft + contentWidth - signX;
      doc
        .fillColor(COLORS.soft)
        .font('CertRegular')
        .fontSize(8)
        .text('ДИРЕКТОР', signX, qrY + 4, {
          width: signWidth,
          align: 'center',
          characterSpacing: 1.5,
        });
      doc
        .fillColor(COLORS.ink)
        .font('CertBold')
        .fontSize(11)
        .text('ЧУП «ДатаВэйв Солюшнс»', signX, qrY + 22, {
          width: signWidth,
          align: 'center',
        });
      doc
        .fillColor(COLORS.accent)
        .font('CertBold')
        .fontSize(14)
        .text('Янчиленко И.А.', signX, qrY + 46, {
          width: signWidth,
          align: 'center',
        });
      doc
        .moveTo(signX + 28, qrY + 68)
        .lineTo(signX + signWidth - 28, qrY + 68)
        .lineWidth(0.7)
        .strokeColor(COLORS.soft)
        .stroke();

      // Soft translucent bar for the disclaimer over the landscape.
      const disclaimerTop = pageHeight - 52;
      doc.save();
      doc
        .rect(48, disclaimerTop - 6, pageWidth - 96, 34)
        .fillOpacity(0.72)
        .fill(COLORS.paperTint);
      doc.restore();
      doc
        .fillColor(COLORS.soft)
        .font('CertRegular')
        .fontSize(7)
        .text(DISCLAIMER, 58, disclaimerTop, {
          width: pageWidth - 116,
          align: 'center',
          lineGap: 1.5,
        });

      doc.end();
    });

    return {
      buffer,
      filename: `certificate-${certificate.registrationNumber}.pdf`,
      verificationUrl,
    };
  }

  private drawOrnament(
    doc: InstanceType<typeof PDFDocument>,
    centerX: number,
    y: number,
  ): void {
    const half = 54;
    doc
      .moveTo(centerX - half, y)
      .lineTo(centerX - 10, y)
      .lineWidth(0.9)
      .strokeColor(COLORS.accent)
      .stroke();
    doc
      .moveTo(centerX + 10, y)
      .lineTo(centerX + half, y)
      .lineWidth(0.9)
      .strokeColor(COLORS.accent)
      .stroke();
    // Small diamond / knot mark in the middle
    doc
      .save()
      .translate(centerX, y)
      .rotate(45)
      .rect(-3.2, -3.2, 6.4, 6.4)
      .fill(COLORS.seal)
      .restore();
  }

  private buildVerificationUrl(certificateId: string): string {
    const base =
      this.config.get<string>('appPublicUrl')?.replace(/\/$/, '')
      ?? `http://localhost:${this.config.get<number>('port') ?? 3001}`;
    return `${base}/verify/certificate/${certificateId}`;
  }
}
