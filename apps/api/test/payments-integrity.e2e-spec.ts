import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('Payments integrity (e2e)', () => {
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

  it('rejects zero amount on payment update', async () => {
    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Payment Integrity ${randomUUID().slice(0, 8)}` })
      .expect(201);

    const paymentRes = await api(app)
      .post('/api/payments')
      .set(authHeader(adminToken))
      .send({
        studentId: studentRes.body.id,
        amount: 1000,
        status: 'paid',
        lessonsAdded: 5,
      })
      .expect(201);

    const updateRes = await api(app)
      .patch(`/api/payments/${paymentRes.body.id}`)
      .set(authHeader(adminToken))
      .send({ amount: 0 });

    expect(updateRes.status).toBe(400);
  });

  it('blocks shop item change after balance was credited', async () => {
    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Shop Item Guard ${randomUUID().slice(0, 8)}` })
      .expect(201);

    const packageA = await api(app)
      .post('/api/payments/shop-items')
      .set(authHeader(adminToken))
      .send({
        name: `Package A ${randomUUID().slice(0, 6)}`,
        type: 'package',
        price: 5000,
        lessonsCount: 4,
      })
      .expect(201);

    const packageB = await api(app)
      .post('/api/payments/shop-items')
      .set(authHeader(adminToken))
      .send({
        name: `Package B ${randomUUID().slice(0, 6)}`,
        type: 'package',
        price: 6000,
        lessonsCount: 6,
      })
      .expect(201);

    const paymentRes = await api(app)
      .post('/api/payments')
      .set(authHeader(adminToken))
      .send({
        studentId: studentRes.body.id,
        amount: 5000,
        status: 'paid',
        shopItemId: packageA.body.id,
        lessonsAdded: 4,
      })
      .expect(201);

    const blocked = await api(app)
      .patch(`/api/payments/${paymentRes.body.id}`)
      .set(authHeader(adminToken))
      .send({ shopItemId: packageB.body.id });

    expect(blocked.status).toBe(400);
  });

  it('allows payment reversal that makes balance negative (debt)', async () => {
    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Balance Debt ${randomUUID().slice(0, 8)}`, lessonBalance: 0 })
      .expect(201);

    const paymentRes = await api(app)
      .post('/api/payments')
      .set(authHeader(adminToken))
      .send({
        studentId: studentRes.body.id,
        amount: 3000,
        status: 'paid',
        lessonsAdded: 5,
      })
      .expect(201);

    await api(app)
      .patch(`/api/students/${studentRes.body.id}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 2 })
      .expect(200);

    const reversed = await api(app)
      .patch(`/api/payments/${paymentRes.body.id}`)
      .set(authHeader(adminToken))
      .send({ lessonsAdded: 0 });

    expect(reversed.status).toBe(200);
    expect(reversed.body.lessonsAdded).toBe(0);

    const studentAfter = await api(app)
      .get(`/api/students/${studentRes.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    // 2 − 5 = −3 (debt allowed)
    expect(studentAfter.body.lessonBalance).toBe(-3);
  });
});
