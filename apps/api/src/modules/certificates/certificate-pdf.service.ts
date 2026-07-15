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

/** Modern ink palette — cool paper, deep slate, single crimson accent. */
const COLORS = {
  paper: '#f7f8fa',
  paperEdge: '#eef1f5',
  ink: '#0f172a',
  muted: '#64748b',
  soft: '#94a3b8',
  line: '#cbd5e1',
  accent: '#9f1239',
  frame: '#1e293b',
  card: '#ffffff',
};

type FontPair = { regular: string; bold: string };

function resolveCyrillicFonts(): FontPair {
  const candidates: FontPair[] = [
    {
      regular: 'C:\\Windows\\Fonts\\arial.ttf',
      bold: 'C:\\Windows\\Fonts\\arialbd.ttf',
    },
    {
      regular: 'C:\\Windows\\Fonts\\segoeui.ttf',
      bold: 'C:\\Windows\\Fonts\\segoeuib.ttf',
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

function formatIssueDate(value: string | null | undefined): string {
  if (!value) return '—';
  // Prefer YYYY-MM-DD as-is; avoid timezone shifts for date-only strings.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}.${m}.${y}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('ru-RU');
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
      width: 160,
      color: { dark: COLORS.ink, light: '#ffffff' },
    });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const fonts = resolveCyrillicFonts();

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
      const margin = 42;
      const contentLeft = margin + 28;
      const contentWidth = pageWidth - contentLeft * 2;

      this.paintBackground(doc, pageWidth, pageHeight);
      this.paintFrame(doc, pageWidth, pageHeight, margin);
      this.paintCornerMarks(doc, pageWidth, pageHeight, margin + 14);

      // Brand
      let y = 88;
      doc
        .fillColor(COLORS.accent)
        .font('CertBold')
        .fontSize(11)
        .text('LONGHUA', contentLeft, y, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 6,
        });
      y += 20;
      doc
        .fillColor(COLORS.muted)
        .font('CertRegular')
        .fontSize(9)
        .text('CHINESE LANGUAGE SCHOOL', contentLeft, y, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 3,
        });

      y += 28;
      this.drawAccentRule(doc, pageWidth / 2, y, 64);

      // Title
      y += 36;
      doc
        .fillColor(COLORS.ink)
        .font('CertBold')
        .fontSize(34)
        .text('СЕРТИФИКАТ', contentLeft, y, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 4,
        });

      y += 52;
      doc
        .fillColor(COLORS.muted)
        .font('CertRegular')
        .fontSize(11)
        .text('настоящим подтверждается, что', contentLeft, y, {
          width: contentWidth,
          align: 'center',
        });

      // Student name card
      y += 36;
      const nameBoxTop = y;
      const nameBoxHeight = 56;
      doc
        .roundedRect(contentLeft + 24, nameBoxTop, contentWidth - 48, nameBoxHeight, 8)
        .fill(COLORS.card);
      doc
        .roundedRect(contentLeft + 24, nameBoxTop, contentWidth - 48, nameBoxHeight, 8)
        .lineWidth(1)
        .strokeColor(COLORS.line)
        .stroke();

      doc
        .fillColor(COLORS.ink)
        .font('CertBold')
        .fontSize(20)
        .text(studentName, contentLeft + 36, nameBoxTop + 18, {
          width: contentWidth - 72,
          align: 'center',
        });

      y = nameBoxTop + nameBoxHeight + 28;
      doc
        .fillColor(COLORS.muted)
        .font('CertRegular')
        .fontSize(11)
        .text('успешно завершил(а) курс', contentLeft, y, {
          width: contentWidth,
          align: 'center',
        });

      y += 26;
      doc
        .fillColor(COLORS.ink)
        .font('CertBold')
        .fontSize(15)
        .text(courseName, contentLeft + 16, y, {
          width: contentWidth - 32,
          align: 'center',
        });

      y += 40;
      this.drawAccentRule(doc, pageWidth / 2, y, 40);

      // Meta + QR row
      const metaTop = Math.max(y + 36, pageHeight - 290);
      const qrSize = 92;
      const qrX = contentLeft;
      const qrY = metaTop;

      doc
        .roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 10)
        .fill(COLORS.card);
      doc
        .roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 10)
        .lineWidth(1)
        .strokeColor(COLORS.line)
        .stroke();
      doc.image(Buffer.from(qrBase64, 'base64'), qrX, qrY, { width: qrSize });

      const metaLeft = qrX + qrSize + 36;
      const metaWidth = contentLeft + contentWidth - metaLeft;
      const issueDate = formatIssueDate(certificate.issueDate);

      const metaRows: Array<[string, string]> = [
        ['Серия бланка', certificate.blankSeries || '—'],
        ['Номер бланка', certificate.blankNumber || '—'],
        ['Дата выдачи', issueDate],
        ['Рег. номер', certificate.registrationNumber || '—'],
      ];

      let metaY = qrY;
      for (const [label, value] of metaRows) {
        doc
          .fillColor(COLORS.soft)
          .font('CertRegular')
          .fontSize(8)
          .text(label.toUpperCase(), metaLeft, metaY, {
            width: metaWidth,
            characterSpacing: 1,
          });
        doc
          .fillColor(COLORS.ink)
          .font('CertBold')
          .fontSize(11)
          .text(value, metaLeft, metaY + 12, { width: metaWidth });
        metaY += 34;
      }

      doc
        .fillColor(COLORS.soft)
        .font('CertRegular')
        .fontSize(8)
        .text('Проверка подлинности по QR-коду', qrX - 8, qrY + qrSize + 14, {
          width: qrSize + 16,
          align: 'center',
        });

      // Footer disclaimer
      doc
        .fillColor(COLORS.soft)
        .font('CertRegular')
        .fontSize(7.5)
        .text(DISCLAIMER, contentLeft, pageHeight - 64, {
          width: contentWidth,
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

  private paintBackground(
    doc: InstanceType<typeof PDFDocument>,
    pageWidth: number,
    pageHeight: number,
  ): void {
    doc.rect(0, 0, pageWidth, pageHeight).fill(COLORS.paper);
    // Soft top wash
    doc.rect(0, 0, pageWidth, 120).fill(COLORS.paperEdge);
    // Soft bottom wash
    doc.rect(0, pageHeight - 100, pageWidth, 100).fill(COLORS.paperEdge);
  }

  private paintFrame(
    doc: InstanceType<typeof PDFDocument>,
    pageWidth: number,
    pageHeight: number,
    margin: number,
  ): void {
    const w = pageWidth - margin * 2;
    const h = pageHeight - margin * 2;

    doc
      .lineWidth(1.5)
      .strokeColor(COLORS.frame)
      .roundedRect(margin, margin, w, h, 6)
      .stroke();

    doc
      .lineWidth(0.6)
      .strokeColor(COLORS.line)
      .roundedRect(margin + 8, margin + 8, w - 16, h - 16, 4)
      .stroke();

    // Thin crimson top accent line inside frame
    const accentY = margin + 22;
    doc
      .moveTo(margin + 48, accentY)
      .lineTo(pageWidth - margin - 48, accentY)
      .lineWidth(1.2)
      .strokeColor(COLORS.accent)
      .stroke();
  }

  private paintCornerMarks(
    doc: InstanceType<typeof PDFDocument>,
    pageWidth: number,
    pageHeight: number,
    inset: number,
  ): void {
    const len = 18;
    doc.lineWidth(1.1).strokeColor(COLORS.accent);

    // Top-left
    doc.moveTo(inset, inset + len).lineTo(inset, inset).lineTo(inset + len, inset).stroke();
    // Top-right
    doc
      .moveTo(pageWidth - inset - len, inset)
      .lineTo(pageWidth - inset, inset)
      .lineTo(pageWidth - inset, inset + len)
      .stroke();
    // Bottom-left
    doc
      .moveTo(inset, pageHeight - inset - len)
      .lineTo(inset, pageHeight - inset)
      .lineTo(inset + len, pageHeight - inset)
      .stroke();
    // Bottom-right
    doc
      .moveTo(pageWidth - inset - len, pageHeight - inset)
      .lineTo(pageWidth - inset, pageHeight - inset)
      .lineTo(pageWidth - inset, pageHeight - inset - len)
      .stroke();
  }

  private drawAccentRule(
    doc: InstanceType<typeof PDFDocument>,
    centerX: number,
    y: number,
    halfWidth: number,
  ): void {
    doc
      .moveTo(centerX - halfWidth, y)
      .lineTo(centerX - 8, y)
      .lineWidth(1)
      .strokeColor(COLORS.line)
      .stroke();
    doc.circle(centerX, y, 2.2).fill(COLORS.accent);
    doc
      .moveTo(centerX + 8, y)
      .lineTo(centerX + halfWidth, y)
      .lineWidth(1)
      .strokeColor(COLORS.line)
      .stroke();
  }

  private buildVerificationUrl(certificateId: string): string {
    const base =
      this.config.get<string>('appPublicUrl')?.replace(/\/$/, '') ??
      `http://localhost:${this.config.get<number>('port') ?? 3001}`;
    return `${base}/api/certificates/${certificateId}/verify`;
  }
}
