import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  adminLogin,
  api,
  authHeader,
  closeTestApp,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';
import { LessonConfirmationJobsService } from '../src/modules/lesson-confirmations/lesson-confirmation-jobs.service';
import { MockTelegramGateway } from '../src/modules/telegram/mock-telegram.gateway';
import { TelegramLinkService } from '../src/modules/telegram/telegram-link.service';
import { TelegramService } from '../src/modules/telegram/telegram.service';
import { StudentEntity } from '../src/modules/students/entities/student.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { LessonEntity } from '../src/modules/lessons/entities/lesson.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

function lessonSlotInHours(hoursFromNow: number): { date: string; startTime: string } {
  const d = new Date(Date.now() + hoursFromNow * 3_600_000);
  const date = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
  const startTime = [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join(':');
  return { date, startTime };
}

describeE2E('Telegram deep-link + 24h reminder (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let mockTelegram: MockTelegramGateway;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    const admin = await adminLogin(app);
    adminToken = admin.token;
    mockTelegram = app.get(MockTelegramGateway);
  }, 120000);

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(() => mockTelegram.clear());

  async function seedActiveStudentUser() {
    const ds = app.get(DataSource);
    const userId = randomUUID();
    const now = new Date();
    const email = `deeplink-${randomUUID().slice(0, 8)}@test.local`;
    const password = 'StudentPass123!';

    await ds.getRepository(UserEntity).save({
      id: userId,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'student',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Deep',
      lastName: 'Link',
      phone: '',
      telegramId: '',
      telegramUsername: '',
      telegramConnectedAt: null,
      telegramLinkToken: null,
      telegramLinkExpires: null,
      createdDate: now,
      updatedDate: now,
    });

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: 'Deep Link Student', email, userId })
      .expect(201);

    const login = await api(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);

    return {
      userId,
      studentId: studentRes.body.id as string,
      token: login.body.token as string,
    };
  }

  it('creates deep link, /start token saves telegram_id, token is one-time', async () => {
    const { userId, studentId, token } = await seedActiveStudentUser();
    const chatId = String(960000000 + Math.floor(Math.random() * 99999));

    const created = await api(app)
      .post('/api/telegram/link/create')
      .set(authHeader(token))
      .expect(201);

    expect(created.body.link).toMatch(/^https:\/\/t\.me\/.+\?start=/);
    expect(created.body.expires_at || created.body.expiresAt).toBeTruthy();

    const startPayload = String(created.body.link).split('start=')[1];
    expect(startPayload).toBeTruthy();

    await app.get(TelegramService).handleUpdate({
      update_id: 100,
      message: {
        text: `/start ${startPayload}`,
        chat: { id: Number(chatId) },
        from: { id: Number(chatId), username: 'deeplink_user', first_name: 'Deep' },
      },
    });

    const ds = app.get(DataSource);
    const user = await ds.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
    const student = await ds.getRepository(StudentEntity).findOneOrFail({ where: { id: studentId } });
    expect(user.telegramId).toBe(chatId);
    expect(user.telegramUsername).toBe('deeplink_user');
    expect(user.telegramConnectedAt).toBeTruthy();
    expect(user.telegramLinkToken).toBeNull();
    expect(student.telegramId).toBe(chatId);

    const status = await api(app)
      .get('/api/telegram/status')
      .set(authHeader(token))
      .expect(200);
    expect(status.body.connected).toBe(true);
    expect(status.body.username).toBe('deeplink_user');

    // reuse token must fail
    mockTelegram.clear();
    await app.get(TelegramService).handleUpdate({
      update_id: 101,
      message: {
        text: `/start ${startPayload}`,
        chat: { id: Number(chatId) + 1 },
        from: { id: Number(chatId) + 1, username: 'other' },
      },
    });
    expect(
      mockTelegram.sentMessages.some((m) => m.text.includes('Ссылка больше не действует')),
    ).toBe(true);

    await api(app)
      .post('/api/telegram/unlink')
      .set(authHeader(token))
      .expect(201);

    const afterUnlink = await ds.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
    expect(afterUnlink.telegramId).toBe('');
    expect(afterUnlink.telegramConnectedAt).toBeNull();
  });

  it('24h reminder sends message without creating confirmation', async () => {
    const chatId = String(961000000 + Math.floor(Math.random() * 99999));
    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: '24h Student',
        email: `r24-${randomUUID().slice(0, 8)}@test.local`,
        telegramId: chatId,
      })
      .expect(201);

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({
        name: '24h Teacher',
        email: `r24-t-${randomUUID().slice(0, 8)}@test.local`,
      })
      .expect(201);

    const slot = lessonSlotInHours(24);
    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacherRes.body.id,
        primaryStudentId: studentRes.body.id,
        date: slot.date,
        startTime: slot.startTime,
        duration: 60,
        status: 'planned',
        lessonType: 'individual',
      })
      .expect(201);

    const jobs = app.get(LessonConfirmationJobsService);
    const first = await jobs.runSendLessonReminders24h();
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(
      mockTelegram.sentMessages.some(
        (m) =>
          m.chatId === chatId
          && m.text.includes('📚 Напоминание об уроке')
          && m.text.includes('Завтра в'),
      ),
    ).toBe(true);

    const ds = app.get(DataSource);
    const lesson = await ds.getRepository(LessonEntity).findOneOrFail({
      where: { id: lessonRes.body.id },
    });
    expect(lesson.reminder24hSent).toBe(true);

    mockTelegram.clear();
    const second = await jobs.runSendLessonReminders24h();
    expect(second.sent).toBe(0);
    expect(mockTelegram.sentMessages.length).toBe(0);
  });
});
