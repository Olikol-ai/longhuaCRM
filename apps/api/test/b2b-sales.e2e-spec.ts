import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';
import { GroupEntity } from '../src/modules/groups/entities/group.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('B2B sales foundation (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    const admin = await adminLogin(app);
    adminToken = admin.token;
  }, 180000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates organization, links group, assigns manager, records receipt with commission', async () => {
    const suffix = randomUUID().slice(0, 8);
    const ds = app.get(DataSource);

    const managerId = randomUUID();
    const now = new Date();
    await ds.getRepository(UserEntity).save({
      id: managerId,
      email: `mgr-${suffix}@test.local`,
      passwordHash: bcrypt.hashSync('TestPass123!', 10),
      role: 'sales_manager',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Иван',
      lastName: 'Менеджер',
      phone: '',
      telegramId: '',
      telegramUsername: '',
      telegramConnectedAt: null,
      telegramLinkToken: null,
      telegramLinkExpires: null,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      telegramNotify24h: true,
      telegramNotify3h: true,
      createdDate: now,
      updatedDate: now,
    });

    await api(app)
      .patch(`/api/b2b/managers/${managerId}/profile`)
      .set(authHeader(adminToken))
      .send({ commissionPercent: '10' })
      .expect(200);

    const orgRes = await api(app)
      .post('/api/b2b/organizations')
      .set(authHeader(adminToken))
      .send({ name: `ООО Ромашка ${suffix}`, unp: '123456789', salesManagerUserId: managerId })
      .expect(201);

    const orgId = orgRes.body.id as string;

    const group = await ds.getRepository(GroupEntity).save({
      name: `Corp Group ${suffix}`,
      status: 'active',
      teacherId: null,
      organizationId: orgId,
      contractAmount: '1200.00',
      contractCurrency: 'BYN',
    });

    const receiptRes = await api(app)
      .post('/api/b2b/receipts')
      .set(authHeader(adminToken))
      .send({
        organizationId: orgId,
        groupId: group.id,
        amount: '500.00',
        status: 'received',
      })
      .expect(201);

    expect(receiptRes.body.sales_manager_user_id).toBe(managerId);

    const accruals = await api(app)
      .get(`/api/b2b/commissions/accruals?managerUserId=${managerId}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(accruals.body.some((row: { commission_amount: string }) => row.commission_amount === '50.00')).toBe(true);

    const counterparty = await api(app)
      .get(`/api/b2b/groups/${group.id}/counterparty`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(counterparty.body.organization_name).toContain('Ромашка');
    expect(counterparty.body.paid_amount).toBe('500.00');
  });
});
