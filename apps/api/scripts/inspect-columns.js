require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Client } = require('pg');

async function main() {
  const url = (process.env.DATABASE_URL || '').replace('longhua_e2e', 'longhua');
  const c = new Client({ connectionString: url });
  await c.connect();
  for (const table of [
    'lessons',
    'groups',
    'enrollments',
    'certificates',
    'course_templates',
    'courses',
    'students',
    'payments',
  ]) {
    const r = await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY 1`,
      [table],
    );
    console.log(`${table}: ${r.rows.map((x) => x.column_name).join(', ') || '(missing)'}`);
  }
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
