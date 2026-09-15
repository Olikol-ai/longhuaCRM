#!/usr/bin/env ts-node
/**
 * Safe repair for directory integrity issues (dry-run by default).
 *
 *   npm run db:repair          # preview
 *   npm run db:repair -- --apply
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { getDatabaseDataSourceOptions } from '../apps/api/src/database/database.config';

loadEnv({ path: resolve(process.cwd(), '.env') });

const apply = process.argv.includes('--apply');

async function main(): Promise<void> {
  const ds = new DataSource({ ...getDatabaseDataSourceOptions(), synchronize: false });
  await ds.initialize();

  const invalidTeachers = await ds.query(`
    SELECT t.id, t.name, t.email, t.status, t.user_id, u.role AS user_role, u.status AS user_status
    FROM teachers t
    LEFT JOIN users u ON u.id = t.user_id
    WHERE t.status = 'active'
      AND (
        t.user_id IS NULL
        OR u.id IS NULL
        OR u.role <> 'teacher'
        OR u.status <> 'active'
      )
    ORDER BY t.name
  `);

  console.log(`=== DATABASE REPAIR ${apply ? '(APPLY)' : '(DRY RUN)'} ===`);
  console.log(`Invalid active teacher profiles to deactivate: ${invalidTeachers.length}`);
  for (const row of invalidTeachers) {
    console.log(`- ${row.name} <${row.email}> user=${row.user_id ?? 'NULL'} role=${row.user_role ?? '-'} status=${row.user_status ?? '-'}`);
  }

  if (apply && invalidTeachers.length > 0) {
    const ids = invalidTeachers.map((row: { id: string }) => row.id);
    await ds.query(
      `UPDATE teachers SET status = 'inactive', updated_at = now() WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    console.log(`Deactivated ${ids.length} invalid teacher profile(s).`);
  } else if (!apply && invalidTeachers.length > 0) {
    console.log('\nRun with --apply to deactivate these profiles (history preserved).');
  } else {
    console.log('Nothing to repair.');
  }

  await ds.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
