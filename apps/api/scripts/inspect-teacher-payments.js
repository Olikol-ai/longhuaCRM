require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Client } = require('pg');

async function main() {
  const url = (process.env.DATABASE_URL || '').replace('longhua_e2e', 'longhua');
  const c = new Client({ connectionString: url });
  await c.connect();
  const cols = await c.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'teacher_payments' ORDER BY 1`,
  );
  console.log('columns:', cols.rows.map((r) => r.column_name).join(', '));
  const idx = await c.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'teacher_payments' ORDER BY 1`,
  );
  console.log('indexes:');
  for (const row of idx.rows) {
    console.log(`  ${row.indexname}: ${row.indexdef}`);
  }
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
