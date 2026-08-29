/**
 * Regression: canonical teacher count tracks create + deactivate.
 * Runs inside a transaction and rolls back — no lasting DB changes.
 */
import { DataSource } from 'typeorm';
import dataSource from '../../database/data-source';

describe('Admin dashboard teacher count regression (DB)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = dataSource;
    if (!ds.isInitialized) {
      await ds.initialize();
    }
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      await ds.destroy();
    }
  });

  async function countCanonical(): Promise<number> {
    const rows = await ds.query(`
      SELECT COUNT(*)::int AS c
      FROM teachers t
      INNER JOIN users u ON u.id = t.user_id
      WHERE t.status = 'active'
        AND u.role = 'teacher'
        AND u.status = 'active'
    `);
    return Number(rows[0]?.c ?? 0);
  }

  it('create 3 teachers → count +3; deactivate 3 → back to baseline', async () => {
    const baseline = await countCanonical();
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const createdUserIds: string[] = [];
      const createdTeacherIds: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const email = `dash-ssot-reg-${Date.now()}-${i}@example.test`;
        const users = await qr.query(
          `INSERT INTO users (id, email, role, status, password_hash, first_name, last_name, created_date, updated_date)
           VALUES (uuid_generate_v4(), $1, 'teacher', 'active', 'x', 'Dash', $2, now(), now())
           RETURNING id`,
          [email, `Reg${i}`],
        );
        const userId = users[0].id;
        createdUserIds.push(userId);
        const teachers = await qr.query(
          `INSERT INTO teachers (id, name, status, user_id, created_at, updated_at)
           VALUES (uuid_generate_v4(), $1, 'active', $2, now(), now())
           RETURNING id`,
          [`Dash Reg ${i}`, userId],
        );
        createdTeacherIds.push(teachers[0].id);
      }

      const afterCreate = await qr.query(`
        SELECT COUNT(*)::int AS c
        FROM teachers t
        INNER JOIN users u ON u.id = t.user_id
        WHERE t.status = 'active'
          AND u.role = 'teacher'
          AND u.status = 'active'
      `);
      expect(Number(afterCreate[0].c)).toBe(baseline + 3);

      await qr.query(
        `UPDATE teachers SET status = 'inactive' WHERE id = ANY($1::uuid[])`,
        [createdTeacherIds],
      );

      const afterDeactivate = await qr.query(`
        SELECT COUNT(*)::int AS c
        FROM teachers t
        INNER JOIN users u ON u.id = t.user_id
        WHERE t.status = 'active'
          AND u.role = 'teacher'
          AND u.status = 'active'
      `);
      expect(Number(afterDeactivate[0].c)).toBe(baseline);

      // Old buggy metric would still count inactive-filtered orphans differently;
      // ensure inactive teachers are excluded from SSOT.
      const buggy = await qr.query(`
        SELECT COUNT(*)::int AS c FROM teachers WHERE status IS DISTINCT FROM 'inactive'
      `);
      // After marking 3 inactive, buggy count drops too for those 3, but baseline
      // buggy may still be higher than SSOT — just assert SSOT restored.
      expect(Number(buggy[0].c)).toBeGreaterThanOrEqual(baseline);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }

    expect(await countCanonical()).toBe(baseline);
  });
});
