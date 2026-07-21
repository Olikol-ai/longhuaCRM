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

/** Fields drawn onto the parchment template (visual layer only). */
export type CertificatePdfRenderInput = {
  registrationNumber: string;
  blankSeries: string | null;
  blankNumber: string | null;
  issueDate: string | null;
  studentName: string;
  courseName: string;
  /** Optional exam/course result line (e.g. level). Omitted when empty. */
  resultLabel?: string | null;
  verificationUrl: string;
  directorName?: string;
  organization?: string;
  teacherLabel?: string;
};

const DISCLAIMER =
  'Данный сертификат не является сертификатом государственного образца и не предоставляет преимуществ, предусмотренных законодательством.';

/** Palette tuned to the Longhua Academy parchment template. */
const COLORS = {
  ink: '#2a1710',
  muted: '#5c4034',
  soft: '#7a5a4a',
  accent: '#9b1c1c',
  seal: '#b91c1c',
  paperTint: '#f7efe3',
  paperSolid: '#faf3e8',
  qrLight: '#fffdf8',
  line: '#c4a484',
};

/**
 * Safe zones for certificate-bg.png (A4 portrait, points).
 * Artwork: red seal + knot at top; plum blossom top-right;
 * ink landscape (pagoda / Great Wall) occupies roughly the lower third.
 * All dynamic text stays in the clear parchment band between them.
 */
const LAYOUT = {
  contentLeft: 78,
  contentRight: 78,
  /**
   * Below red seal + baked-in knot divider in certificate-bg.png.
   * After full-page stretch the knot sits near y≈195–205 — brand must clear it.
   */
  brandY: 222,
  titleY: 268,
  bodyStartY: 312,
  /** Hard stop before landscape mist / pagoda silhouettes. */
  contentMaxBottom: 520,
  footerTop: 528,
  footerPanelHeight: 140,
  qrSize: 62,
} as const;

type FontPair = {
  regular: string;
  bold: string;
  /** Required for .ttc collections (PDFKit + fontkit). */
  regularFace?: string;
  boldFace?: string;
};

/**
 * Prefer CJK-capable fonts so Cyrillic, Latin and Chinese names all render.
 * Times/Georgia lack CJK glyphs and show tofu / overlap artifacts.
 */
function resolveCertificateFonts(): FontPair {
  const candidates: FontPair[] = [
    {
      regular: 'C:\\Windows\\Fonts\\msyh.ttc',
      bold: 'C:\\Windows\\Fonts\\msyhbd.ttc',
      regularFace: 'MicrosoftYaHei',
      boldFace: 'MicrosoftYaHei-Bold',
    },
    {
      regular: 'C:\\Windows\\Fonts\\malgun.ttf',
      bold: 'C:\\Windows\\Fonts\\malgunbd.ttf',
    },
    {
      regular: 'C:\\Windows\\Fonts\\simsunb.ttf',
      bold: 'C:\\Windows\\Fonts\\simsunb.ttf',
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
      regular: '/usr/share/fonts/truetype/noto/NotoSansSC-Regular.otf',
      bold: '/usr/share/fonts/truetype/noto/NotoSansSC-Bold.otf',
    },
    {
      regular: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      bold: '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
      regularFace: 'NotoSansCJKsc-Regular',
      boldFace: 'NotoSansCJKsc-Bold',
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
    'Не найден шрифт с поддержкой кириллицы/CJK для PDF сертификата',
  );
}

function resolveCertificateBackground(): string {
  const candidates = [
    join(__dirname, '../../assets/certificates/certificate-bg.png'),
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

function quoteCourseName(courseName: string): string {
  const trimmed = courseName.trim();
  if (/^[«"“]/.test(trimmed) || /[»"”]$/.test(trimmed)) {
    return trimmed;
  }
  return `«${trimmed}»`;
}

function fitFontSize(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  font: string,
  maxWidth: number,
  preferred: number,
  min: number,
): number {
  let size = preferred;
  while (size > min) {
    doc.font(font).fontSize(size);
    if (doc.widthOfString(text) <= maxWidth) {
      return size;
    }
    size -= 1;
  }
  return min;
}

/** Shrink until wrapped text fits within maxHeight (for long course titles). */
function fitFontSizeForWrapped(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  font: string,
  maxWidth: number,
  maxHeight: number,
  preferred: number,
  min: number,
): number {
  let size = preferred;
  while (size > min) {
    doc.font(font).fontSize(size);
    const height = doc.heightOfString(text, { width: maxWidth, lineGap: 3 });
    if (height <= maxHeight) {
      return size;
    }
    size -= 1;
  }
  return min;
}

/**
 * Pure visual renderer — used by CertificatePdfService and sample scripts.
 * Does not touch API / ACL / numbering business logic.
 */
export async function renderCertificatePdfBuffer(
  input: CertificatePdfRenderInput,
): Promise<Buffer> {
  const fonts = resolveCertificateFonts();
  const backgroundPath = resolveCertificateBackground();
  const qrDataUrl = await QRCode.toDataURL(input.verificationUrl, {
    margin: 1,
    width: 160,
    color: { dark: COLORS.ink, light: COLORS.qrLight },
    errorCorrectionLevel: 'M',
  });
  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');

  const directorName = input.directorName?.trim() || 'Янчиленко И.А.';
  const organization = input.organization?.trim() || 'ЧУП «ДатаВэйв Солюшнс»';
  const teacherLabel = input.teacherLabel?.trim() || 'Преподаватель';
  const resultLabel = input.resultLabel?.trim() || '';

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `Сертификат ${input.registrationNumber}`,
        Author: 'Longhua Academy',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (fonts.regularFace) {
      doc.registerFont('CertRegular', fonts.regular, fonts.regularFace);
    } else {
      doc.registerFont('CertRegular', fonts.regular);
    }
    if (fonts.boldFace) {
      doc.registerFont('CertBold', fonts.bold, fonts.boldFace);
    } else {
      doc.registerFont('CertBold', fonts.bold);
    }

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentLeft = LAYOUT.contentLeft;
    const contentWidth = pageWidth - LAYOUT.contentLeft - LAYOUT.contentRight;

    // Full-bleed parchment artwork (border, seal, landscape already in PNG).
    doc.image(backgroundPath, 0, 0, {
      width: pageWidth,
      height: pageHeight,
    });

    // ── Top brand (under seal + knot, not over them) ──────────────────────
    let y: number = LAYOUT.brandY;
    doc
      .fillColor(COLORS.accent)
      .font('CertBold')
      .fontSize(12)
      .text('LONGHUA ACADEMY', contentLeft, y, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });

    y += 18;
    doc
      .fillColor(COLORS.soft)
      .font('CertRegular')
      .fontSize(9)
      .text('Образовательная академия', contentLeft, y, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });

    // ── Title ─────────────────────────────────────────────────────────────
    y = Math.max(y + 26, LAYOUT.titleY);
    doc
      .fillColor(COLORS.ink)
      .font('CertBold')
      .fontSize(30)
      .text('СЕРТИФИКАТ', contentLeft, y, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });

    y += 38;
    drawOrnament(doc, pageWidth / 2, y);

    // Soft parchment plate behind body/meta only — must not cover the title.
    const plateTop = LAYOUT.bodyStartY - 6;
    const plateBottom = LAYOUT.contentMaxBottom + 8;
    doc.save();
    doc
      .roundedRect(contentLeft - 10, plateTop, contentWidth + 20, plateBottom - plateTop, 10)
      .fillOpacity(0.72)
      .fill(COLORS.paperSolid);
    doc.restore();

    // Meta lines reserved at the bottom of the content plate (never pulled upward).
    const metaLines = [
      `Дата выдачи: ${formatIssueDate(input.issueDate)}`,
    ];
    if (resultLabel) {
      metaLines.push(resultLabel);
    }
    metaLines.push(`Номер сертификата: ${input.registrationNumber || '—'}`);
    const blankBits = [
      input.blankSeries ? `Серия: ${input.blankSeries}` : '',
      input.blankNumber ? `№ бланка: ${input.blankNumber}` : '',
    ]
      .filter(Boolean)
      .join('    ·    ');
    if (blankBits) {
      metaLines.push(blankBits);
    }
    const metaLineH = 15;
    const metaBlockH = metaLines.length * metaLineH;
    const metaTop = LAYOUT.contentMaxBottom - metaBlockH;
    const bodyBottomLimit = metaTop - 12;

    // ── Body (flows downward; stops above reserved meta band) ─────────────
    y = LAYOUT.bodyStartY;

    doc
      .fillColor(COLORS.muted)
      .font('CertRegular')
      .fontSize(12)
      .text('Настоящий сертификат подтверждает, что', contentLeft, y, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });

    y = doc.y + 14;
    const nameMaxWidth = contentWidth - 20;
    const nameSize = fitFontSize(
      doc,
      input.studentName,
      'CertBold',
      nameMaxWidth,
      input.studentName.length > 40 ? 18 : 22,
      12,
    );
    doc
      .fillColor(COLORS.ink)
      .font('CertBold')
      .fontSize(nameSize)
      .text(input.studentName, contentLeft + 10, y, {
        width: nameMaxWidth,
        align: 'center',
        lineGap: 3,
      });

    const nameUnderlineY = doc.y + 8;
    doc
      .moveTo(pageWidth / 2 - 100, nameUnderlineY)
      .lineTo(pageWidth / 2 + 100, nameUnderlineY)
      .lineWidth(0.7)
      .strokeColor(COLORS.accent)
      .stroke();

    y = nameUnderlineY + 14;
    doc
      .fillColor(COLORS.muted)
      .font('CertRegular')
      .fontSize(11)
      .text('успешно завершил(а) курс / экзамен', contentLeft, y, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });

    y = doc.y + 10;
    const courseText = quoteCourseName(input.courseName);
    const courseMaxHeight = Math.max(20, bodyBottomLimit - y);
    const courseSize = fitFontSizeForWrapped(
      doc,
      courseText,
      'CertBold',
      contentWidth - 24,
      Math.min(48, courseMaxHeight),
      courseText.length > 50 ? 12 : 14,
      8,
    );
    // Only draw course if there is still room above the reserved meta band.
    if (y < bodyBottomLimit - 8) {
      doc
        .fillColor(COLORS.ink)
        .font('CertBold')
        .fontSize(courseSize)
        .text(courseText, contentLeft + 12, y, {
          width: contentWidth - 24,
          align: 'center',
          lineGap: 3,
          height: Math.min(48, courseMaxHeight),
          ellipsis: true,
        });
    }

    // ── Meta block in reserved band (always below body) ───────────────────
    let metaY = metaTop;
    for (const line of metaLines) {
      const metaSize = fitFontSize(doc, line, 'CertRegular', contentWidth, 10, 7);
      doc
        .fillColor(COLORS.muted)
        .font('CertRegular')
        .fontSize(metaSize)
        .text(line, contentLeft, metaY, {
          width: contentWidth,
          align: 'center',
          lineBreak: false,
        });
      metaY += metaLineH;
    }

    // ── Footer panel: QR + signatures over landscape mist ─────────────────
    const footerTop = LAYOUT.footerTop;
    const panelX = 56;
    const panelW = pageWidth - 112;
    const panelH = LAYOUT.footerPanelHeight;

    doc.save();
    doc
      .roundedRect(panelX, footerTop, panelW, panelH, 8)
      .fillOpacity(0.92)
      .fill(COLORS.paperSolid);
    doc.restore();
    doc
      .roundedRect(panelX, footerTop, panelW, panelH, 8)
      .lineWidth(0.6)
      .strokeColor(COLORS.line)
      .stroke();

    const qrSize = LAYOUT.qrSize;
    const qrX = panelX + 16;
    const qrY = footerTop + 12;

    doc
      .roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 4)
      .fill(COLORS.qrLight);
    doc.image(Buffer.from(qrBase64, 'base64'), qrX, qrY, { width: qrSize });
    doc
      .fillColor(COLORS.soft)
      .font('CertRegular')
      .fontSize(7)
      .text('Проверка подлинности', qrX - 6, qrY + qrSize + 6, {
        width: qrSize + 12,
        align: 'center',
      });

    const signsLeft = qrX + qrSize + 28;
    const signsWidth = panelX + panelW - signsLeft - 12;
    const colGap = 16;
    const colWidth = (signsWidth - colGap) / 2;

    drawSignatureColumn(doc, {
      x: signsLeft,
      y: footerTop + 14,
      width: colWidth,
      role: teacherLabel.toUpperCase(),
      name: '',
      organization: '',
      showName: false,
    });

    drawSignatureColumn(doc, {
      x: signsLeft + colWidth + colGap,
      y: footerTop + 14,
      width: colWidth,
      role: 'ДИРЕКТОР',
      name: directorName,
      organization,
      showName: true,
    });

    // Disclaimer inside the panel (keeps landscape art clean below).
    const disclaimerY = footerTop + panelH - 34;
    doc
      .moveTo(panelX + 14, disclaimerY - 6)
      .lineTo(panelX + panelW - 14, disclaimerY - 6)
      .lineWidth(0.4)
      .strokeColor(COLORS.line)
      .stroke();
    doc
      .fillColor(COLORS.soft)
      .font('CertRegular')
      .fontSize(6.5)
      .text(DISCLAIMER, panelX + 12, disclaimerY, {
        width: panelW - 24,
        align: 'center',
        lineGap: 1.2,
      });

    doc.end();
  });
}

function drawSignatureColumn(
  doc: InstanceType<typeof PDFDocument>,
  opts: {
    x: number;
    y: number;
    width: number;
    role: string;
    name: string;
    organization: string;
    showName: boolean;
  },
): void {
  const { x, y, width, role, name, organization, showName } = opts;

  // Role
  doc
    .fillColor(COLORS.soft)
    .font('CertRegular')
    .fontSize(8)
    .text(role, x, y, {
      width,
      align: 'center',
      lineBreak: false,
    });

  let cursor = y + 12;

  if (organization) {
    const orgSize = fitFontSize(doc, organization, 'CertRegular', width - 4, 7, 6);
    doc
      .fillColor(COLORS.muted)
      .font('CertRegular')
      .fontSize(orgSize)
      .text(organization, x, cursor, {
        width,
        align: 'center',
        height: 16,
        ellipsis: true,
      });
    cursor += 18;
  } else {
    cursor += 8;
  }

  // Open space for handwritten signature; printed name sits clearly below.
  const lineY = cursor + 12;
  doc
    .moveTo(x + 10, lineY)
    .lineTo(x + width - 10, lineY)
    .lineWidth(0.55)
    .strokeColor(COLORS.soft)
    .stroke();

  if (showName && name) {
    const nameSize = fitFontSize(doc, name, 'CertBold', width - 4, 9, 7);
    doc
      .fillColor(COLORS.accent)
      .font('CertBold')
      .fontSize(nameSize)
      .text(name, x, lineY + 14, {
        width,
        align: 'center',
        lineBreak: false,
      });
  }
}

function drawOrnament(
  doc: InstanceType<typeof PDFDocument>,
  centerX: number,
  y: number,
): void {
  const half = 48;
  doc
    .moveTo(centerX - half, y)
    .lineTo(centerX - 8, y)
    .lineWidth(0.8)
    .strokeColor(COLORS.accent)
    .stroke();
  doc
    .moveTo(centerX + 8, y)
    .lineTo(centerX + half, y)
    .lineWidth(0.8)
    .strokeColor(COLORS.accent)
    .stroke();
  doc
    .save()
    .translate(centerX, y)
    .rotate(45)
    .rect(-2.8, -2.8, 5.6, 5.6)
    .fill(COLORS.seal)
    .restore();
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
    const buffer = await renderCertificatePdfBuffer({
      registrationNumber: certificate.registrationNumber,
      blankSeries: certificate.blankSeries,
      blankNumber: certificate.blankNumber,
      issueDate: certificate.issueDate,
      studentName,
      courseName,
      verificationUrl,
    });

    return {
      buffer,
      filename: `certificate-${certificate.registrationNumber}.pdf`,
      verificationUrl,
    };
  }

  private buildVerificationUrl(certificateId: string): string {
    const base =
      this.config.get<string>('appPublicUrl')?.replace(/\/$/, '')
      ?? `http://localhost:${this.config.get<number>('port') ?? 3001}`;
    return `${base}/verify/certificate/${certificateId}`;
  }
}
