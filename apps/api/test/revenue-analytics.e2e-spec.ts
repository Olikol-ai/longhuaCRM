import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';
import { coerceDecimalValue } from '../src/database/numeric-column.transformer';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

function sumPaymentAmounts(payments: Array<{ amount: unknown }>): number {
  return payments.reduce((sum, item) => sum + coerceDecimalValue(item.amount as string | number), 0);
}

describeE2E('Revenue analytics amounts (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    const admin = await adminLogin(app);
    adminToken = admin.token;
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns payment amount as JSON number, not string', async () => {
    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Revenue Amount ${randomUUID().slice(0, 8)}` })
      .expect(201);

    await api(app)
      .post('/api/payments')
      .set(authHeader(adminToken))
      .send({
        studentId: studentRes.body.id,
        amount: 80,
        status: 'paid',
        lessonsAdded: 1,
      })
      .expect(201);

    const listRes = await api(app)
      .get('/api/payments')
      .set(authHeader(adminToken))
      .expect(200);

    const created = listRes.body.find(
      (row: { student_id: string }) => row.student_id === studentRes.body.id,
    );
    expect(created).toBeTruthy();
    expect(typeof created.amount).toBe('number');
    expect(created.amount).toBe(80);
  });

  it('sums 80 + 80 + 50 as 210, not string concatenation', async () => {
    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Revenue Sum ${randomUUID().slice(0, 8)}` })
      .expect(201);

    const paymentDate = new Date().toISOString().split('T')[0];
    for (const amount of [80, 80, 50]) {
      await api(app)
        .post('/api/payments')
        .set(authHeader(adminToken))
        .send({
          studentId: studentRes.body.id,
          amount,
          status: 'paid',
          lessonsAdded: 1,
          paymentDate,
        })
        .expect(201);
    }

    const listRes = await api(app)
      .get('/api/payments')
      .set(authHeader(adminToken))
      .expect(200);

    const rows = listRes.body.filter(
      (row: { student_id: string }) => row.student_id === studentRes.body.id,
    );
    expect(rows).toHaveLength(3);
    expect(sumPaymentAmounts(rows)).toBe(210);
    expect(sumPaymentAmounts(rows.map((row: { amount: number }) => ({ amount: String(row.amount) })))).toBe(
      210,
    );
  });

  it('returns zero sum for empty payment selection', () => {
    expect(sumPaymentAmounts([])).toBe(0);
  });
});

describe('Revenue amount coercion (unit)', () => {
  it('coerces numeric strings from PostgreSQL', () => {
    expect(coerceDecimalValue('80.00')).toBe(80);
    expect(coerceDecimalValue('50.00')).toBe(50);
  });

  it('avoids string concatenation when summing', () => {
    expect(0 + '80.00' + '80.00' + '50.00').toBe('080.0080.0050.00');
    expect(
      sumPaymentAmounts([
        { amount: '80.00' },
        { amount: '80.00' },
        { amount: '50.00' },
      ]),
    ).toBe(210);
  });
});
