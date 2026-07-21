/**
 * One-shot visual QA for certificate PDF layout.
 * Usage (from apps/api): npx ts-node -r tsconfig-paths/register src/modules/certificates/generate-certificate-pdf-samples.ts
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { renderCertificatePdfBuffer } from './certificate-pdf.service';

async function main() {
  const outDir = join(process.cwd(), '../../tmp-cert-samples');
  mkdirSync(outDir, { recursive: true });

  const samples = [
    {
      file: '01-ordinary.pdf',
      studentName: 'Иванов Алексей',
      courseName: 'Китайский язык HSK 1',
      registrationNumber: 'LH-2026-0001',
      blankSeries: 'А',
      blankNumber: '1001',
      resultLabel: 'Уровень: HSK 1',
    },
    {
      file: '02-long-name.pdf',
      studentName:
        'Янчиленко-Петровская Александра Константиновна',
      courseName: 'Китайский язык HSK 2',
      registrationNumber: 'LH-2026-0002-LONG-REG-NUMBER-XYZ',
      blankSeries: 'АБ',
      blankNumber: '20260015',
      resultLabel: null,
    },
    {
      file: '03-chinese-name.pdf',
      studentName: '王小明',
      courseName: 'HSK 1 入门课程',
      registrationNumber: 'LH-2026-ZH-0003',
      blankSeries: 'ZH',
      blankNumber: '88',
      resultLabel: '成绩：优秀',
    },
    {
      file: '04-long-course.pdf',
      studentName: 'Maria Petrova',
      courseName:
        'Интенсивный курс китайского языка для взрослых: разговорная практика, иероглифика и подготовка к HSK 3 (вечерняя группа)',
      registrationNumber: 'LH-2026-0004',
      blankSeries: 'B',
      blankNumber: '44',
      resultLabel: 'Результат: сдан',
    },
    {
      file: '05-max-filled.pdf',
      studentName: '李娜 · Елена Владимировна Смирнова-Ковальчук',
      courseName:
        '«Полный цикл подготовки к HSK 4» — аудирование, чтение, письмо и устная речь (модуль 2025/2026)',
      registrationNumber: 'LH-CERT-2026-MAX-0000000005',
      blankSeries: 'MAX-SERIES',
      blankNumber: '99999999',
      resultLabel: 'Уровень / результат: HSK 4 · 92%',
    },
  ] as const;

  for (const sample of samples) {
    const buffer = await renderCertificatePdfBuffer({
      registrationNumber: sample.registrationNumber,
      blankSeries: sample.blankSeries,
      blankNumber: sample.blankNumber,
      issueDate: '2026-07-21',
      studentName: sample.studentName,
      courseName: sample.courseName,
      resultLabel: sample.resultLabel,
      verificationUrl: `http://localhost:3001/verify/certificate/sample-${sample.file}`,
    });
    const path = join(outDir, sample.file);
    writeFileSync(path, buffer);
    console.log(`Wrote ${path} (${buffer.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
