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
import { StudentEntity } from '../src/modules/students/entities/student.entity';
import { TeacherEntity } from '../src/modules/teachers/entities/teacher.entity';
import { PendingRegistrationEntity } from '../src/modules/auth/entities/pending-registration.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('User deletion by admin (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    const admin = await adminLogin(app);
    adminToken = admin.token;
    const ds = app.get(DataSource);
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@test.local';
    const adminRow = await ds.getRepository(UserEntity).findOne({
      where: { email: adminEmail },
    });
    if (!adminRow) {
      throw new Error(`Admin user not found: ${adminEmail}`);
    }
    adminUserId = adminRow.id;
  }, 180000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function seedUser(email: string, role: string): Promise<string> {
    const userId = randomUUID();
    const now = new Date();
    const ds = app.get(DataSource);
    await ds.getRepository(UserEntity).save({
      id: userId,
      email,
      passwordHash: bcrypt.hashSync('TestPass123!', 10),
      role,
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Delete',
      lastName: 'Me',
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
    return userId;
  }

  async function assertNotInDirectory(userId: string) {
    const directory = await api(app)
      .get('/api/users/directory')
      .set(authHeader(adminToken))
      .expect(200);
    expect(directory.body.some((row: { id: string }) => row.id === userId)).toBe(false);
  }

  async function assertNotInRegistry(id: string, query: Record<string, string> = {}) {
    const registry = await api(app)
      .get('/api/users/registry')
      .query({ limit: '100', ...query })
      .set(authHeader(adminToken))
      .expect(200);
    expect(registry.body.items.some((row: { id: string }) => row.id === id)).toBe(false);
  }

  async function assertInRegistry(id: string, query: Record<string, string> = {}) {
    const registry = await api(app)
      .get('/api/users/registry')
      .query({ limit: '100', ...query })
      .set(authHeader(adminToken))
      .expect(200);
    expect(registry.body.items.some((row: { id: string }) => row.id === id)).toBe(true);
  }

  async function seedPendingRegistration(email: string): Promise<string> {
    const id = randomUUID();
    const now = new Date();
    const ds = app.get(DataSource);
    await ds.getRepository(PendingRegistrationEntity).save({
      id,
      email,
      passwordHash: bcrypt.hashSync('TestPass123!', 10),
      firstName: 'Pending',
      lastName: 'Reg',
      phone: '',
      wantsStudentRole: false,
      inviteTeacherId: null,
      inviteLinkId: null,
      inviteTutorId: null,
      inviteTutorLinkId: null,
      verificationCodeHash: bcrypt.hashSync('123456', 10),
      codeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdDate: now,
      updatedDate: now,
    });
    return id;
  }

  it('admin cannot delete own account', async () => {
    await api(app)
      .delete(`/api/users/${adminUserId}`)
      .set(authHeader(adminToken))
      .expect(403);
  });

  it('deletes user with no role (explicit user)', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `del-none-${suffix}@test.local`;
    const userId = await seedUser(email, 'user');

    await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);
    await assertNotInDirectory(userId);
    await assertNotInRegistry(userId, { roles: 'user' });

    const ds = app.get(DataSource);
    expect(await ds.getRepository(UserEntity).count({ where: { id: userId } })).toBe(0);
  });

  it('deletes awaiting-role user', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `del-pending-${suffix}@test.local`;
    const userId = await seedUser(email, '');

    await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);
    await assertNotInDirectory(userId);
    await assertNotInRegistry(userId, { roles: 'pending' });
  });

  it('deletes student user and linked profile', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `del-student-${suffix}@test.local`;
    const userId = await seedUser(email, 'student');
    const ds = app.get(DataSource);
    const studentId = randomUUID();
    await ds.getRepository(StudentEntity).save({
      id: studentId,
      name: 'Del Student',
      email,
      userId,
      status: 'active',
      lessonBalance: 0,
    });

    await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);
    await assertNotInDirectory(userId);
    expect(await ds.getRepository(StudentEntity).count({ where: { id: studentId } })).toBe(0);
  });

  it('deletes teacher user and linked profile', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `del-teacher-${suffix}@test.local`;
    const userId = await seedUser(email, 'teacher');
    const ds = app.get(DataSource);
    const teacherId = randomUUID();
    await ds.getRepository(TeacherEntity).save({
      id: teacherId,
      name: 'Del Teacher',
      email,
      firstName: 'Del',
      lastName: 'Teacher',
      userId,
      status: 'active',
    });

    await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);
    await assertNotInDirectory(userId);
    expect(await ds.getRepository(TeacherEntity).count({ where: { id: teacherId } })).toBe(0);
  });

  it('second delete returns 404 not 500', async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(`del-twice-${suffix}@test.local`, 'user');
    await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);
    await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(404);
  });

  it('deletes sales_manager and keeps organization plus receipts', async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(`del-sm-${suffix}@test.local`, 'sales_manager');
    const ds = app.get(DataSource);

    await ds.query(
      `INSERT INTO sales_manager_profiles (id, user_id, commission_percent, status)
       VALUES ($1, $2, 10, 'active')`,
      [randomUUID(), userId],
    );
    const orgId = randomUUID();
    await ds.query(
      `INSERT INTO organizations (id, name, sales_manager_user_id, status)
       VALUES ($1, $2, $3, 'active')`,
      [orgId, `Org ${suffix}`, userId],
    );
    const receiptId = randomUUID();
    await ds.query(
      `INSERT INTO organization_receipts
        (id, organization_id, amount, currency, status, sales_manager_user_id)
       VALUES ($1, $2, 1500, 'BYN', 'received', $3)`,
      [receiptId, orgId, userId],
    );
    await ds.query(
      `INSERT INTO sales_commission_accruals
        (id, receipt_id, manager_user_id, rate_percent, commission_amount, currency, status)
       VALUES ($1, $2, $3, 10, 150, 'BYN', 'accrued')`,
      [randomUUID(), receiptId, userId],
    );

    await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);
    await assertNotInDirectory(userId);
    expect(await ds.getRepository(UserEntity).count({ where: { id: userId } })).toBe(0);

    const org = await ds.query(`SELECT id, sales_manager_user_id FROM organizations WHERE id = $1`, [
      orgId,
    ]);
    expect(org).toHaveLength(1);
    expect(org[0].sales_manager_user_id).toBeNull();

    const receipts = await ds.query(
      `SELECT id, amount FROM organization_receipts WHERE id = $1`,
      [receiptId],
    );
    expect(receipts).toHaveLength(1);
    expect(String(receipts[0].amount)).toBe('1500.00');

    const accruals = await ds.query(
      `SELECT commission_amount, manager_user_id FROM sales_commission_accruals WHERE receipt_id = $1`,
      [receiptId],
    );
    expect(accruals).toHaveLength(1);
    expect(String(accruals[0].commission_amount)).toBe('150.00');
    expect(accruals[0].manager_user_id).toBeNull();
  });

  it('deletes teacher with a group without removing the group', async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(`del-tgroup-${suffix}@test.local`, 'teacher');
    const ds = app.get(DataSource);
    const { GroupEntity } = await import('../src/modules/groups/entities/group.entity');
    const teacherId = randomUUID();
    await ds.getRepository(TeacherEntity).save({
      id: teacherId,
      name: `T ${suffix}`,
      email: `del-tgroup-${suffix}@test.local`,
      firstName: 'Del',
      lastName: 'T',
      userId,
      status: 'active',
    });
    const group = await ds.getRepository(GroupEntity).save({
      name: `G ${suffix}`,
      status: 'active',
      teacherId,
    });

    await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);
    const kept = await ds.getRepository(GroupEntity).findOne({ where: { id: group.id } });
    expect(kept).toBeTruthy();
    expect(kept?.teacherId).toBeNull();
  });

  it('deletes student and preserves homework attempt history', async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(`del-hw-${suffix}@test.local`, 'student');
    const ds = app.get(DataSource);
    const studentId = randomUUID();
    await ds.getRepository(StudentEntity).save({
      id: studentId,
      name: 'HW Student',
      email: `del-hw-${suffix}@test.local`,
      userId,
      status: 'active',
      lessonBalance: 0,
    });

    const attemptId = randomUUID();
    const hwExists = await ds.query(`SELECT to_regclass('public.homework_attempts') AS name`);
    if (hwExists[0]?.name) {
      await ds.query(
        `INSERT INTO homework_attempts (id, assignment_id, homework_id, student_id, user_id, status, started_at)
         SELECT $1, a.id, a.homework_id, $2, $3, 'started', now()
         FROM homework_assignments a
         LIMIT 1`,
        [attemptId, studentId, userId],
      ).catch(() => undefined);
    }

    await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);
    expect(await ds.getRepository(UserEntity).count({ where: { id: userId } })).toBe(0);

    if (hwExists[0]?.name) {
      const leftover = await ds.query(
        `SELECT id, user_id FROM homework_attempts WHERE id = $1`,
        [attemptId],
      );
      if (leftover.length > 0) {
        expect(leftover[0].user_id).toBeNull();
      }
    }
  });

  describe('incomplete accounts and pending registrations (section 18)', () => {
    it('deletes user with assigned role (teacher) from registry', async () => {
      const suffix = randomUUID().slice(0, 8);
      const email = `del-role-${suffix}@test.local`;
      const userId = await seedUser(email, 'teacher');
      await assertInRegistry(userId, { roles: 'teacher', search: email });

      await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);

      await assertNotInRegistry(userId, { search: email });
      await assertNotInRegistry(userId, { roles: 'teacher' });
      const ds = app.get(DataSource);
      expect(await ds.getRepository(UserEntity).count({ where: { id: userId } })).toBe(0);
    });

    it('deletes belov-like user: empty role, blocked, linked teacher profile, exam authorship', async () => {
      const suffix = randomUUID().slice(0, 8);
      const email = `belov-reg-${suffix}@test.local`;
      const userId = randomUUID();
      const now = new Date();
      const ds = app.get(DataSource);
      await ds.getRepository(UserEntity).save({
        id: userId,
        email,
        passwordHash: bcrypt.hashSync('TestPass123!', 10),
        role: '',
        status: 'blocked',
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
        verificationCodeSentAt: null,
        verificationAttempts: 0,
        firstName: 'Арсений',
        lastName: 'Белов',
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
      const teacherId = randomUUID();
      await ds.getRepository(TeacherEntity).save({
        id: teacherId,
        name: email,
        email,
        firstName: 'Арсений',
        lastName: 'Белов',
        userId,
        status: 'active',
      });
      const examExists = await ds.query(`SELECT to_regclass('public.assessment_exams') AS name`);
      if (examExists[0]?.name) {
        await ds.query(
          `INSERT INTO assessment_exams (id, name, created_by_user_id, status)
           VALUES ($1, $2, $3, 'draft')`,
          [randomUUID(), `[Test] Belov ${suffix}`, userId],
        );
      }

      await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);
      await assertNotInRegistry(userId, { search: email });

      expect(await ds.getRepository(UserEntity).count({ where: { id: userId } })).toBe(0);
      expect(await ds.getRepository(TeacherEntity).count({ where: { id: teacherId } })).toBe(0);
    });

    it('deletes pending registration entry and removes DB row', async () => {
      const suffix = randomUUID().slice(0, 8);
      const email = `del-pending-reg-${suffix}@test.local`;
      const pendingId = await seedPendingRegistration(email);
      await assertInRegistry(pendingId, { roles: 'registration', search: email });

      await api(app)
        .delete(`/api/users/pending-registrations/${pendingId}`)
        .set(authHeader(adminToken))
        .expect(200);

      await assertNotInRegistry(pendingId, { search: email });
      await assertNotInRegistry(pendingId, { roles: 'registration' });

      const ds = app.get(DataSource);
      expect(
        await ds.getRepository(PendingRegistrationEntity).count({ where: { id: pendingId } }),
      ).toBe(0);
    });

    it('deleting user also removes linked pending_registrations by email', async () => {
      const suffix = randomUUID().slice(0, 8);
      const email = `del-user-pending-${suffix}@test.local`;
      const userId = await seedUser(email, 'user');
      const pendingId = await seedPendingRegistration(email);

      await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);

      const ds = app.get(DataSource);
      expect(await ds.getRepository(UserEntity).count({ where: { id: userId } })).toBe(0);
      expect(
        await ds.getRepository(PendingRegistrationEntity).count({ where: { id: pendingId } }),
      ).toBe(0);
      expect(
        await ds.getRepository(PendingRegistrationEntity).count({ where: { email } }),
      ).toBe(0);
    });

    it('registry reload after delete does not show removed entries', async () => {
      const suffix = randomUUID().slice(0, 8);
      const email = `del-reload-${suffix}@test.local`;
      const userId = await seedUser(email, '');
      const pendingId = await seedPendingRegistration(`del-reload-pr-${suffix}@test.local`);

      await api(app).delete(`/api/users/${userId}`).set(authHeader(adminToken)).expect(200);
      await api(app)
        .delete(`/api/users/pending-registrations/${pendingId}`)
        .set(authHeader(adminToken))
        .expect(200);

      const registry = await api(app)
        .get('/api/users/registry')
        .query({ limit: '100', search: suffix })
        .set(authHeader(adminToken))
        .expect(200);

      const ids = registry.body.items.map((row: { id: string }) => row.id);
      expect(ids).not.toContain(userId);
      expect(ids).not.toContain(pendingId);
    });

    it('second pending registration delete returns 404 not 500', async () => {
      const pendingId = await seedPendingRegistration(
        `del-pending-twice-${randomUUID().slice(0, 8)}@test.local`,
      );
      await api(app)
        .delete(`/api/users/pending-registrations/${pendingId}`)
        .set(authHeader(adminToken))
        .expect(200);
      await api(app)
        .delete(`/api/users/pending-registrations/${pendingId}`)
        .set(authHeader(adminToken))
        .expect(404);
    });

    it('blocks pending registration delete when account already exists for email', async () => {
      const suffix = randomUUID().slice(0, 8);
      const email = `del-pr-conflict-${suffix}@test.local`;
      await seedUser(email, 'user');
      const pendingId = await seedPendingRegistration(email);

      await api(app)
        .delete(`/api/users/pending-registrations/${pendingId}`)
        .set(authHeader(adminToken))
        .expect(409);
    });
  });
});
