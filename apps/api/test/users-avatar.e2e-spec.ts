import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import {
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
  login,
} from './e2e-helpers';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

const PASSWORD = 'TestPass123!';

async function makePng(size = 64): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

async function createActiveUser(
  app: INestApplication,
  role: 'admin' | 'student' | 'teacher' | 'tutor',
  label: string,
): Promise<{ userId: string; token: string; email: string }> {
  const userId = randomUUID();
  const now = new Date();
  const email = `avatar-${role}-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const ds = app.get(DataSource);
  await ds.getRepository(UserEntity).save({
    id: userId,
    email,
    passwordHash: bcrypt.hashSync(PASSWORD, 10),
    role,
    status: 'active',
    emailVerified: true,
    verificationCode: null,
    verificationCodeExpiresAt: null,
    verificationCodeSentAt: null,
    verificationAttempts: 0,
    firstName: 'Avatar',
    lastName: label,
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
    avatarFilePath: null,
    avatarThumbPath: null,
    avatarUpdatedAt: null,
    createdDate: now,
    updatedDate: now,
  });

  const session = await login(app, email, PASSWORD);
  return { userId, token: session.token, email };
}

describeE2E('Users avatar (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
  }, 180000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('allows student/teacher/tutor to upload own avatar', async () => {
    const png = await makePng();
    for (const role of ['student', 'teacher', 'tutor'] as const) {
      const user = await createActiveUser(app, role, role);
      const res = await api(app)
        .post('/api/users/me/avatar')
        .set(authHeader(user.token))
        .attach('file', png, 'selfie.png');

      expect(res.status).toBe(201);
      expect(res.body.has_avatar).toBe(true);
      expect(res.body.avatar_updated_at).toBeTruthy();
    }
  });

  it('forbids teacher/student from uploading or deleting another user avatar', async () => {
    const png = await makePng();
    const teacher = await createActiveUser(app, 'teacher', 'acl-t');
    const student = await createActiveUser(app, 'student', 'acl-s');

    const uploadOther = await api(app)
      .post(`/api/users/${student.userId}/avatar`)
      .set(authHeader(teacher.token))
      .attach('file', png, 'x.png');
    expect(uploadOther.status).toBe(403);

    const deleteOther = await api(app)
      .delete(`/api/users/${student.userId}/avatar`)
      .set(authHeader(teacher.token));
    expect(deleteOther.status).toBe(403);

    const studentUploadOther = await api(app)
      .post(`/api/users/${teacher.userId}/avatar`)
      .set(authHeader(student.token))
      .attach('file', png, 'x.png');
    expect(studentUploadOther.status).toBe(403);
  });

  it('allows admin to upload and delete another user avatar', async () => {
    const png = await makePng();
    const admin = await createActiveUser(app, 'admin', 'admin-actor');
    const student = await createActiveUser(app, 'student', 'admin-target');

    const upload = await api(app)
      .post(`/api/users/${student.userId}/avatar`)
      .set(authHeader(admin.token))
      .attach('file', png, 'admin.png');
    expect(upload.status).toBe(201);
    expect(upload.body.has_avatar).toBe(true);

    const getRes = await api(app)
      .get(`/api/users/${student.userId}/avatar?thumb=1`)
      .set(authHeader(admin.token));
    expect(getRes.status).toBe(200);
    expect(String(getRes.headers['content-type'] || '')).toMatch(/image\/webp/);

    const remove = await api(app)
      .delete(`/api/users/${student.userId}/avatar`)
      .set(authHeader(admin.token));
    expect(remove.status).toBe(200);
    expect(remove.body.has_avatar).toBe(false);
  });

  it('rejects oversized files', async () => {
    const admin = await createActiveUser(app, 'admin', 'size');
    const big = Buffer.alloc(5 * 1024 * 1024 + 1024, 1);
    const res = await api(app)
      .post('/api/users/me/avatar')
      .set(authHeader(admin.token))
      .attach('file', big, 'huge.png');
    expect([400, 413]).toContain(res.status);
  });

  it('rejects unsupported extensions', async () => {
    const admin = await createActiveUser(app, 'admin', 'ext');
    const res = await api(app)
      .post('/api/users/me/avatar')
      .set(authHeader(admin.token))
      .attach('file', Buffer.from('not-an-image'), 'payload.gif');
    expect(res.status).toBe(400);
  });

  it('requires auth for GET avatar', async () => {
    const admin = await createActiveUser(app, 'admin', 'get-auth');
    const png = await makePng();
    await api(app)
      .post('/api/users/me/avatar')
      .set(authHeader(admin.token))
      .attach('file', png, 'admin-self.png')
      .expect(201);

    const unauth = await api(app).get(`/api/users/${admin.userId}/avatar`);
    expect(unauth.status).toBe(401);

    const authGet = await api(app)
      .get(`/api/users/${admin.userId}/avatar`)
      .set(authHeader(admin.token));
    expect(authGet.status).toBe(200);
    expect(String(authGet.headers['content-type'] || '')).toMatch(/image\/webp/);
  });

  it('rejects invalid avatar user id without crashing', async () => {
    const admin = await createActiveUser(app, 'admin', 'bad-id');
    const res = await api(app)
      .get('/api/users/undefined/avatar')
      .set(authHeader(admin.token));
    expect(res.status).toBe(404);
  });
});
