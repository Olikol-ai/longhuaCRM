require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Client } = require('pg');

async function main() {
  const url = (process.env.DATABASE_URL || '').replace('longhua_e2e', 'longhua');
  const c = new Client({ connectionString: url });
  await c.connect();
  const tables = await c.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`,
  );
  console.log('tables:', tables.rows.map((r) => r.tablename).join(', '));
  const cols = await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='students' ORDER BY 1`,
  );
  const assigned = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='students' AND column_name LIKE 'assigned%'`,
  );
  console.log('assigned cols:', assigned.rows);
  const m = await c.query('SELECT name FROM migrations ORDER BY id').catch(() => ({ rows: [] }));
  console.log('migrations:', m.rows.map((r) => r.name).join(', ') || '(none)');
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
