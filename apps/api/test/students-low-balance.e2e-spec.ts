import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';

describe('Students low-balance list (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    const admin = await adminLogin(app);
    adminToken = admin.token;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns only active students with lesson_balance <= 2', async () => {
    const suffix = randomUUID().slice(0, 8);

    const create = async (payload: Record<string, unknown>) => {
      const res = await api(app)
        .post('/api/students')
        .set(authHeader(adminToken))
        .send(payload);
      expect(res.status).toBe(201);
      return res.body.id as string;
    };

    const setBalance = async (id: string, lessonBalance: number) => {
      const res = await api(app)
        .patch(`/api/students/${id}`)
        .set(authHeader(adminToken))
        .send({ lessonBalance });
      expect(res.status).toBe(200);
    };

    const id0 = await create({
      name: `Low0 ${suffix}`,
      status: 'active',
      email: `low0-${suffix}@test.local`,
      phone: '+375291000001',
    });
    const id1 = await create({
      name: `Low1 ${suffix}`,
      status: 'active',
      email: `low1-${suffix}@test.local`,
    });
    const id2 = await create({
      name: `Low2 ${suffix}`,
      status: 'active',
    });
    const id3 = await create({
      name: `Ok3 ${suffix}`,
      status: 'active',
    });
    const idInactive = await create({
      name: `InactiveLow ${suffix}`,
      status: 'inactive',
    });
    const idPaused = await create({
      name: `PausedLow ${suffix}`,
      status: 'paused',
    });

    const idDebt = await create({
      name: `DebtNeg ${suffix}`,
      status: 'active',
    });

    await setBalance(id0, 0);
    await setBalance(id1, 1);
    await setBalance(id2, 2);
    await setBalance(id3, 3);
    await setBalance(idDebt, -4);
    await setBalance(idInactive, 0);
    await setBalance(idPaused, 1);

    const listRes = await api(app)
      .get('/api/students/low-balance')
      .set(authHeader(adminToken));
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);

    const ids = new Set(
      listRes.body.map((row: { id: string }) => row.id as string),
    );

    expect(ids.has(id0)).toBe(true);
    expect(ids.has(id1)).toBe(true);
    expect(ids.has(id2)).toBe(true);
    expect(ids.has(idDebt)).toBe(true);
    expect(ids.has(id3)).toBe(false);
    expect(ids.has(idInactive)).toBe(false);
    expect(ids.has(idPaused)).toBe(false);

    const rowDebt = listRes.body.find((row: { id: string }) => row.id === idDebt);
    expect(rowDebt.lesson_balance ?? rowDebt.lessonBalance).toBe(-4);

    const row0 = listRes.body.find((row: { id: string }) => row.id === id0);
    expect(row0.name).toContain(`Low0 ${suffix}`);
    expect(row0.lesson_balance ?? row0.lessonBalance).toBe(0);
    expect(row0.email ?? null).toBe(`low0-${suffix}@test.local`);
    expect(row0.phone ?? null).toBe('+375291000001');

    // Soft-delete style: mark inactive and ensure gone from list
    await api(app)
      .patch(`/api/students/${id2}`)
      .set(authHeader(adminToken))
      .send({ status: 'inactive' });

    const afterInactive = await api(app)
      .get('/api/students/low-balance')
      .set(authHeader(adminToken));
    const idsAfter = new Set(
      afterInactive.body.map((row: { id: string }) => row.id as string),
    );
    expect(idsAfter.has(id2)).toBe(false);
  });
});
