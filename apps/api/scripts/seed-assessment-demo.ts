/**
 * Safe Assessment demo seed — HSK Demo 1.
 *
 * Usage (from apps/api):
 *   ASSESSMENT_DEMO_SEED=1 npm run seed:assessment-demo
 *
 * Safety:
 * - Refuses production unless ASSESSMENT_DEMO_SEED_FORCE=1
 * - Requires ASSESSMENT_DEMO_SEED=1
 * - Idempotent (reuses published "HSK Demo 1" if present)
 */
import 'reflect-metadata';
import { existsSync } from 'fs';
import { join } from 'path';
import { config as loadDotenv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UsersRepository } from '../src/modules/users/users.repository';
import { StudentsService } from '../src/modules/students/students.service';
import {
  AssessmentBankService,
  QuestionAuthoringService,
  ExamTemplateService,
  BlueprintService,
  ExamService,
  AssignmentService,
} from '../src/modules/assessment/services';
import {
  ASSESSMENT_DEMO,
  seedAssessmentDemo,
} from '../src/modules/assessment/demo/assessment-demo.seed';

function loadEnv(): void {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '..', '.env'),
    join(__dirname, '../../../.env'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path });
      console.log(`Loaded env from ${path}`);
      return;
    }
  }
  loadDotenv();
}

function assertSeedAllowed(): void {
  const confirmed =
    process.env.ASSESSMENT_DEMO_SEED === '1' || process.argv.includes('--yes');
  if (!confirmed) {
    console.error(
      'Refusing to run: set ASSESSMENT_DEMO_SEED=1 or pass --yes to create demo Assessment data.',
    );
    process.exit(1);
  }

  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  if (nodeEnv === 'production' && process.env.ASSESSMENT_DEMO_SEED_FORCE !== '1') {
    console.error(
      'Refusing to seed production. Set ASSESSMENT_DEMO_SEED_FORCE=1 only if intentional.',
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  loadEnv();
  assertSeedAllowed();

  const logger = new Logger('seed-assessment-demo');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const users = app.get(UsersRepository);
    const adminEmail =
      process.env.ADMIN_EMAIL?.trim().toLowerCase() || 'admin@longhua.local';
    const admin = await users.findByEmail(adminEmail);
    if (!admin) {
      throw new Error(
        `Admin user ${adminEmail} not found. Start the API once so default admin is seeded, or set ADMIN_EMAIL.`,
      );
    }

    const actor = {
      sub: admin.id,
      role: 'admin' as const,
      email: admin.email,
    };

    const result = await seedAssessmentDemo({
      dataSource: app.get(DataSource),
      banks: app.get(AssessmentBankService),
      questions: app.get(QuestionAuthoringService),
      templates: app.get(ExamTemplateService),
      blueprints: app.get(BlueprintService),
      exams: app.get(ExamService),
      assignments: app.get(AssignmentService),
      students: app.get(StudentsService),
      actor,
      logger,
    });

    console.log('');
    console.log('=== Assessment demo seed complete ===');
    console.log(`Exam:       ${ASSESSMENT_DEMO.examName} (${result.examId})`);
    console.log(`Assignment: ${result.assignmentId}`);
    console.log(`Student:    ${result.studentEmail} / ${result.studentPassword}`);
    console.log(`Skipped:    ${result.skipped}`);
    console.log('Login as the demo student and open «Мои экзамены».');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
