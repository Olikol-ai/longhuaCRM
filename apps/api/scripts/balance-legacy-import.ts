#!/usr/bin/env ts-node
/**
 * Idempotent legacy balance → student_balance_ledger import.
 *
 *   npm run balance:legacy-import          # dry-run
 *   npm run balance:legacy-import -- --apply
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

// MUST load env before AppModule (UPLOADS_DIR etc. are read at import time).
loadEnv({ path: resolve(__dirname, '../../../.env') });
if (!process.env.UPLOADS_DIR) {
  process.env.UPLOADS_DIR = '/tmp/longhua-uploads-legacy-import';
}

const apply = process.argv.includes('--apply');

async function main(): Promise<void> {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { StudentBalanceLegacyMigrationService } = await import(
    '../src/modules/student-balances/student-balance-legacy-migration.service'
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const migration = app.get(StudentBalanceLegacyMigrationService);
    console.log(`=== BALANCE LEGACY IMPORT ${apply ? '(APPLY)' : '(DRY RUN)'} ===`);
    const report = await migration.importAll({ dryRun: !apply });
    console.log(
      JSON.stringify(
        {
          studentsProcessed: report.studentsProcessed,
          studentsCorrected: report.studentsCorrected,
          studentsUnchanged: report.studentsUnchanged,
          lowConfidenceAdjustments: report.lowConfidenceAdjustments,
          allReconciled: report.allReconciled,
          corrected: report.results
            .filter((r) => r.balanceChanged)
            .map((r) => ({
              name: r.name,
              before: r.balanceBefore,
              after: r.balanceAfter,
              restores: r.appliedMutations,
              legacyRecon: r.legacyReconciliationDelta,
            })),
          unreconciled: report.results
            .filter((r) => !r.reconciled)
            .map((r) => ({
              name: r.name,
              balance: r.balanceAfter,
              ledger: r.ledgerSum,
            })),
          lowConfidence: report.results
            .filter((r) => r.legacyReconciliationDelta !== 0)
            .map((r) => ({
              name: r.name,
              delta: r.legacyReconciliationDelta,
              balance: r.balanceAfter,
            })),
        },
        null,
        2,
      ),
    );
    if (!report.allReconciled && apply) {
      process.exitCode = 2;
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
