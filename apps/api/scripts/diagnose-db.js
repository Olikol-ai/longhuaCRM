require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL || '';
  const db = url.match(/\/([^/?]+)(\?|$)/)?.[1] || '(unknown)';
  console.log('NODE_ENV:', process.env.NODE_ENV ?? '(unset)');
  console.log('DATABASE name:', db);
  if (!url) {
    console.log('DATABASE_URL not set');
    return;
  }
  const c = new Client({ connectionString: url });
  await c.connect();
  const users = await c.query(
    `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users'`,
  );
  const migrations = await c.query(`SELECT COUNT(*)::int AS n FROM migrations`).catch(() => ({
    rows: [{ n: 0 }],
  }));
  console.log('users table:', users.rows.length ? 'exists' : 'MISSING');
  console.log('migrations applied:', migrations.rows[0].n);
  await c.end();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
