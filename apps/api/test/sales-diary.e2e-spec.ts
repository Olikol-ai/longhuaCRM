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
  login,
} from './e2e-helpers';
import { OrganizationReceiptEntity } from '../src/modules/b2b-sales/entities/organization-receipt.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;
const PASSWORD = 'TestPass123!';

async function seedManager(
  ds: DataSource,
  suffix: string,
  label: 'a' | 'b',
): Promise<{ id: string; token: string }> {
  const id = randomUUID();
  const email = `diary-mgr-${label}-${suffix}@test.local`;
  const now = new Date();
  await ds.getRepository(UserEntity).save({
    id,
    email,
    passwordHash: bcrypt.hashSync(PASSWORD, 10),
    role: 'sales_manager',
    status: 'active',
    emailVerified: true,
    verificationCode: null,
    verificationCodeExpiresAt: null,
    verificationCodeSentAt: null,
    verificationAttempts: 0,
    firstName: label === 'a' ? 'Анна' : 'Борис',
    lastName: label === 'a' ? 'Менеджер' : 'Другой',
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
  return { id, token: '' };
}

describeE2E('Sales diary (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let ds: DataSource;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    ds = app.get(DataSource);
    const admin = await adminLogin(app);
    adminToken = admin.token;
  }, 180000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('covers admin assign → manager workflow → deal without auto receipt → commission from receipt', async () => {
    const suffix = randomUUID().slice(0, 8);
    const managerA = await seedManager(ds, suffix, 'a');
    const managerB = await seedManager(ds, suffix, 'b');
    managerA.token = (await login(app, `diary-mgr-a-${suffix}@test.local`, PASSWORD)).token;
    managerB.token = (await login(app, `diary-mgr-b-${suffix}@test.local`, PASSWORD)).token;

    await api(app)
      .patch(`/api/b2b/managers/${managerA.id}/profile`)
      .set(authHeader(adminToken))
      .send({ commissionPercent: '10' })
      .expect(200);

    const orgRes = await api(app)
      .post('/api/b2b/organizations')
      .set(authHeader(adminToken))
      .send({ name: `ООО Дневник ${suffix}`, unp: '998877665' })
      .expect(201);
    const orgId = orgRes.body.id as string;

    const entryRes = await api(app)
      .post('/api/b2b/diary/entries')
      .set(authHeader(adminToken))
      .send({ organizationId: orgId, salesManagerUserId: managerA.id })
      .expect(201);

    const entryId = entryRes.body.id as string;
    expect(entryRes.body.status).toBe('new');

    const mgrAList = await api(app)
      .get('/api/b2b/diary/entries')
      .set(authHeader(managerA.token))
      .expect(200);
    expect(mgrAList.body.some((row: { id: string }) => row.id === entryId)).toBe(true);

    const mgrBList = await api(app)
      .get('/api/b2b/diary/entries')
      .set(authHeader(managerB.token))
      .expect(200);
    expect(mgrBList.body.some((row: { id: string }) => row.id === entryId)).toBe(false);

    await api(app)
      .post(`/api/b2b/diary/entries/${entryId}/notes`)
      .set(authHeader(managerA.token))
      .send({ note: 'Поговорил с директором, интересует 15 сотрудников.' })
      .expect(201);

    await api(app)
      .post(`/api/b2b/diary/entries/${entryId}/notes`)
      .set(authHeader(managerA.token))
      .send({ note: 'Отправил КП.' })
      .expect(201);

    const detailAfterNotes = await api(app)
      .get(`/api/b2b/diary/entries/${entryId}`)
      .set(authHeader(managerA.token))
      .expect(200);
    expect(detailAfterNotes.body.notes).toHaveLength(2);

    const nextContact = new Date();
    nextContact.setDate(nextContact.getDate() + 3);

    await api(app)
      .post(`/api/b2b/diary/entries/${entryId}/contacts`)
      .set(authHeader(managerA.token))
      .send({
        contactType: 'call',
        contactedAt: new Date().toISOString(),
        result: 'Договорились созвониться',
        nextContactAt: nextContact.toISOString(),
      })
      .expect(201);

    await api(app)
      .patch(`/api/b2b/diary/entries/${entryId}`)
      .set(authHeader(managerA.token))
      .send({ status: 'negotiations', potentialStudentsCount: 15 })
      .expect(200);

    const dealRes = await api(app)
      .post(`/api/b2b/diary/entries/${entryId}/deals`)
      .set(authHeader(managerA.token))
      .send({
        studentsCount: 20,
        pricePerStudent: '800.00',
        amount: '16000.00',
        currency: 'BYN',
        contractDate: '2026-09-01',
        comment: 'Корпоративный договор',
      })
      .expect(201);

    expect(dealRes.body.students_count).toBe(20);
    expect(dealRes.body.amount).toBe('16000.00');

    const receiptsBefore = await ds.getRepository(OrganizationReceiptEntity).count({
      where: { organizationId: orgId },
    });
    expect(receiptsBefore).toBe(0);

    const updatedEntry = await api(app)
      .get(`/api/b2b/diary/entries/${entryId}`)
      .set(authHeader(managerA.token))
      .expect(200);
    expect(updatedEntry.body.status).toBe('contract_signed');
    expect(updatedEntry.body.deal_students_count).toBe(20);

    await api(app)
      .post('/api/b2b/receipts')
      .set(authHeader(adminToken))
      .send({
        organizationId: orgId,
        amount: '5000.00',
        status: 'received',
      })
      .expect(201);

    const accruals = await api(app)
      .get(`/api/b2b/commissions/accruals?managerUserId=${managerA.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(accruals.body.some((row: { commission_amount: string }) => row.commission_amount === '500.00')).toBe(
      true,
    );

    const adminView = await api(app)
      .get(`/api/b2b/diary/entries?managerUserId=${managerA.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(adminView.body.some((row: { id: string }) => row.id === entryId)).toBe(true);
    expect(adminView.body[0]?.latest_note_preview).toContain('КП');

    await api(app)
      .patch(`/api/b2b/diary/entries/${entryId}/reassign`)
      .set(authHeader(adminToken))
      .send({ salesManagerUserId: managerB.id })
      .expect(200);

    const historyAfterReassign = await api(app)
      .get(`/api/b2b/diary/entries/${entryId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(historyAfterReassign.body.notes).toHaveLength(2);
    expect(historyAfterReassign.body.contacts).toHaveLength(1);
    expect(historyAfterReassign.body.sales_manager_user_id).toBe(managerB.id);

    await api(app)
      .get(`/api/b2b/diary/entries/${entryId}`)
      .set(authHeader(managerA.token))
      .expect(403);

    const mgrBView = await api(app)
      .get('/api/b2b/diary/entries')
      .set(authHeader(managerB.token))
      .expect(200);
    expect(mgrBView.body.some((row: { id: string }) => row.id === entryId)).toBe(true);

    const summary = await api(app)
      .get('/api/b2b/diary/summary')
      .set(authHeader(managerB.token))
      .expect(200);
    expect(summary.body.diary_entries_count).toBeGreaterThanOrEqual(1);
  });

  it('denies teacher access to diary endpoints', async () => {
    const suffix = randomUUID().slice(0, 8);
    const teacherId = randomUUID();
    const now = new Date();
    await ds.getRepository(UserEntity).save({
      id: teacherId,
      email: `diary-teacher-${suffix}@test.local`,
      passwordHash: bcrypt.hashSync(PASSWORD, 10),
      role: 'teacher',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Уч',
      lastName: 'Итель',
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
    const teacherToken = (await login(app, `diary-teacher-${suffix}@test.local`, PASSWORD)).token;

    await api(app)
      .get('/api/b2b/diary/entries')
      .set(authHeader(teacherToken))
      .expect(403);
  });
});
