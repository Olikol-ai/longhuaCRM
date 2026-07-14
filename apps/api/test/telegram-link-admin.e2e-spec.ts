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
  futureLessonDate,
} from './e2e-helpers';
import { LessonConfirmationEntity } from '../src/modules/lesson-confirmations/entities/lesson-confirmation.entity';
import { LessonConfirmationService } from '../src/modules/lesson-confirmations/lesson-confirmation.service';
import { MockTelegramGateway } from '../src/modules/telegram/mock-telegram.gateway';
import { StudentEntity } from '../src/modules/students/entities/student.entity';
import { TeacherEntity } from '../src/modules/teachers/entities/teacher.entity';
import { TelegramLinkService } from '../src/modules/telegram/telegram-link.service';
import { TelegramService } from '../src/modules/telegram/telegram.service';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('Telegram link sync + admin status + confirmations (e2e)', () => {
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

  beforeEach(() => {
    mockTelegram.clear();
  });

  it('serializes student telegramId as telegram_id for admin UI', async () => {
    const chatId = String(910000000 + Math.floor(Math.random() * 99999));
    const createRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: 'TG Serialize Student',
        email: `tg-ser-${randomUUID().slice(0, 8)}@test.local`,
        telegramId: chatId,
      })
      .expect(201);

    expect(createRes.body.telegram_id).toBe(chatId);

    const listRes = await api(app)
      .get('/api/students')
      .set(authHeader(adminToken))
      .expect(200);

    const listed = (listRes.body as Array<{ id: string; telegram_id?: string }>).find(
      (row) => row.id === createRes.body.id,
    );
    expect(listed?.telegram_id).toBe(chatId);
  });

  it('linkTelegramByToken syncs User + Student telegram_id', async () => {
    const ds = app.get(DataSource);
    const linkService = app.get(TelegramLinkService);
    const userId = randomUUID();
    const chatId = String(920000000 + Math.floor(Math.random() * 99999));
    const token = `tok_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date();

    await ds.getRepository(UserEntity).save({
      id: userId,
      email: `link-stu-${randomUUID().slice(0, 8)}@test.local`,
      passwordHash: bcrypt.hashSync('StudentPass123!', 10),
      role: 'student',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Link',
      lastName: 'Student',
      phone: '',
      telegramId: '',
      telegramUsername: '',
      telegramConnectedAt: null,
      telegramLinkToken: token,
      telegramLinkExpires: new Date(Date.now() + 60 * 60 * 1000),
      createdDate: now,
      updatedDate: now,
    });

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: 'Link Student',
        email: `link-stu-prof-${randomUUID().slice(0, 8)}@test.local`,
        userId,
      })
      .expect(201);

    const linked = await linkService.completeLinkByToken(token, chatId, 'linked_user');
    expect(linked).toBe(true);

    const user = await ds.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
    const student = await ds
      .getRepository(StudentEntity)
      .findOneOrFail({ where: { id: studentRes.body.id } });

    expect(user.telegramId).toBe(chatId);
    expect(student.telegramId).toBe(chatId);
    expect(student.telegramUsername).toBe('linked_user');

    const listRes = await api(app)
      .get('/api/students')
      .set(authHeader(adminToken))
      .expect(200);
    const listed = (listRes.body as Array<{ id: string; telegram_id?: string }>).find(
      (row) => row.id === student.id,
    );
    expect(listed?.telegram_id).toBe(chatId);

    const sendTest = await api(app)
      .post('/api/telegram/admin/send-test')
      .set(authHeader(adminToken))
      .send({
        targetType: 'student',
        targetId: student.id,
        message: 'admin test',
      })
      .expect(201);

    expect(sendTest.body.ok).toBe(true);
    expect(sendTest.body.telegram_id).toBe(chatId);
    expect(mockTelegram.sentMessages.some((m) => m.chatId === chatId)).toBe(true);
  });

  it('linkTelegramByToken syncs Teacher telegram_id', async () => {
    const ds = app.get(DataSource);
    const linkService = app.get(TelegramLinkService);
    const userId = randomUUID();
    const chatId = String(930000000 + Math.floor(Math.random() * 99999));
    const token = `tok_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date();

    await ds.getRepository(UserEntity).save({
      id: userId,
      email: `link-tea-${randomUUID().slice(0, 8)}@test.local`,
      passwordHash: bcrypt.hashSync('TeacherPass123!', 10),
      role: 'teacher',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Link',
      lastName: 'Teacher',
      phone: '',
      telegramId: '',
      telegramUsername: '',
      telegramConnectedAt: null,
      telegramLinkToken: token,
      telegramLinkExpires: new Date(Date.now() + 60 * 60 * 1000),
      createdDate: now,
      updatedDate: now,
    });

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({
        name: 'Link Teacher',
        email: `link-tea-prof-${randomUUID().slice(0, 8)}@test.local`,
        userId,
      })
      .expect(201);

    const linked = await linkService.completeLinkByToken(token, chatId, 'tea_user');
    expect(linked).toBe(true);

    const teacher = await ds
      .getRepository(TeacherEntity)
      .findOneOrFail({ where: { id: teacherRes.body.id } });
    expect(teacher.telegramId).toBe(chatId);
  });

  it('GET /telegram/admin/status returns mode and debug snapshot', async () => {
    const res = await api(app)
      .get('/api/telegram/admin/status')
      .set(authHeader(adminToken))
      .expect(200);

    expect(res.body).toMatchObject({
      mock: true,
      mode: 'polling',
      bot_token_configured: expect.any(Boolean),
      polling: expect.objectContaining({
        expected: expect.any(Boolean),
        running: expect.any(Boolean),
      }),
      debug: expect.objectContaining({
        received_update_count: expect.any(Number),
      }),
    });
  });

  it('callback confirm/decline via confirmation id', async () => {
    const ds = app.get(DataSource);
    const confirmations = app.get(LessonConfirmationService);
    const telegram = app.get(TelegramService);
    const chatId = String(940000000 + Math.floor(Math.random() * 99999));

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: 'Confirm Flow Student',
        email: `confirm-flow-${randomUUID().slice(0, 8)}@test.local`,
        telegramId: chatId,
      })
      .expect(201);

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({
        name: 'Confirm Flow Teacher',
        email: `confirm-flow-t-${randomUUID().slice(0, 8)}@test.local`,
      })
      .expect(201);

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacherRes.body.id,
        primaryStudentId: studentRes.body.id,
        date: futureLessonDate(1),
        startTime: '10:00',
        duration: 60,
        status: 'planned',
        lessonType: 'individual',
      })
      .expect(201);

    const pending = await confirmations.sendTestConfirmation(
      studentRes.body.id,
      lessonRes.body.id,
    );

    await telegram.handleUpdate({
      update_id: 1,
      callback_query: {
        id: 'cb1',
        data: `lesson_confirm:${pending.id}`,
        from: { id: Number(chatId) },
        message: { chat: { id: Number(chatId) } },
      },
    });

    let row = await ds.getRepository(LessonConfirmationEntity).findOneOrFail({
      where: { id: pending.id },
    });
    expect(row.status).toBe('CONFIRMED');
    expect(row.confirmedAt).toBeTruthy();

    const lesson2 = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacherRes.body.id,
        primaryStudentId: studentRes.body.id,
        date: futureLessonDate(2),
        startTime: '11:00',
        duration: 60,
        status: 'planned',
        lessonType: 'individual',
      })
      .expect(201);

    const declinePending = await confirmations.sendTestConfirmation(
      studentRes.body.id,
      lesson2.body.id,
    );

    await telegram.handleUpdate({
      update_id: 2,
      callback_query: {
        id: 'cb2',
        data: `lesson_decline:${declinePending.id}`,
        from: { id: Number(chatId) },
        message: { chat: { id: Number(chatId) } },
      },
    });

    row = await ds.getRepository(LessonConfirmationEntity).findOneOrFail({
      where: { id: declinePending.id },
    });
    expect(row.status).toBe('DECLINED');
    expect(row.declinedAt).toBeTruthy();
  });

  it('admin send-test resolves User.telegram_id when student profile field empty', async () => {
    const ds = app.get(DataSource);
    const userId = randomUUID();
    const chatId = String(941000000 + Math.floor(Math.random() * 99999));
    const now = new Date();

    await ds.getRepository(UserEntity).save({
      id: userId,
      email: `user-tg-${randomUUID().slice(0, 8)}@test.local`,
      passwordHash: bcrypt.hashSync('StudentPass123!', 10),
      role: 'student',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'User',
      lastName: 'TG',
      phone: '',
      telegramId: chatId,
      telegramUsername: 'from_user',
      telegramConnectedAt: now,
      telegramLinkToken: null,
      telegramLinkExpires: null,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      telegramNotify24h: true,
      telegramNotify3h: true,
      createdDate: now,
      updatedDate: now,
    });

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: 'User TG Student',
        email: `stu-tg-${randomUUID().slice(0, 8)}@test.local`,
        userId,
      })
      .expect(201);

    await ds.getRepository(StudentEntity).update(studentRes.body.id, {
      telegramId: null,
      telegramUsername: null,
    });

    const listRes = await api(app)
      .get('/api/students')
      .set(authHeader(adminToken))
      .expect(200);
    const listed = (listRes.body as Array<{ id: string; telegram_id?: string }>).find(
      (row) => row.id === studentRes.body.id,
    );
    expect(listed?.telegram_id).toBe(chatId);

    const sendRes = await api(app)
      .post('/api/telegram/admin/send-test')
      .set(authHeader(adminToken))
      .send({
        targetType: 'student',
        targetId: studentRes.body.id,
      })
      .expect(201);

    expect(sendRes.body.ok).toBe(true);
    expect(sendRes.body.linked).toBe(true);
    expect(sendRes.body.telegram_id).toBe(chatId);
    expect(
      mockTelegram.sentMessages.some(
        (m) =>
          m.chatId === chatId
          && m.text.includes('Тестовое уведомление Longhua CRM'),
      ),
    ).toBe(true);

    await app.get(TelegramService).handleUpdate({
      update_id: 55,
      message: {
        text: '/start',
        chat: { id: Number(chatId) },
        from: { id: Number(chatId), first_name: 'Ilya', username: 'from_user' },
      },
    });
    expect(
      mockTelegram.sentMessages.some((m) =>
        m.text.includes('✅ Longhua CRM подключён'),
      ),
    ).toBe(true);
  });

  it('button menu shows nearest lesson and settings', async () => {
    const ds = app.get(DataSource);
    const telegram = app.get(TelegramService);
    const chatId = String(942000000 + Math.floor(Math.random() * 99999));

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: 'Menu Student',
        email: `menu-${randomUUID().slice(0, 8)}@test.local`,
        telegramId: chatId,
      })
      .expect(201);

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({
        name: 'Menu Teacher',
        email: `menu-t-${randomUUID().slice(0, 8)}@test.local`,
      })
      .expect(201);

    await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacherRes.body.id,
        primaryStudentId: studentRes.body.id,
        date: futureLessonDate(1),
        startTime: '18:30',
        duration: 60,
        status: 'planned',
        lessonType: 'individual',
      })
      .expect(201);

    // Ensure users.telegram_id source of truth for chat
    const student = await ds.getRepository(StudentEntity).findOneOrFail({
      where: { id: studentRes.body.id },
    });
    if (student.userId) {
      await ds.getRepository(UserEntity).update(student.userId, {
        telegramId: chatId,
        telegramConnectedAt: new Date(),
      });
    } else {
      // Seed a linked user for the student telegram id path used by menu
      const userId = randomUUID();
      const now = new Date();
      await ds.getRepository(UserEntity).save({
        id: userId,
        email: `menu-user-${randomUUID().slice(0, 8)}@test.local`,
        passwordHash: bcrypt.hashSync('StudentPass123!', 10),
        role: 'student',
        status: 'active',
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
        verificationCodeSentAt: null,
        verificationAttempts: 0,
        firstName: 'Menu',
        lastName: 'User',
        phone: '',
        telegramId: chatId,
        telegramUsername: 'menu_user',
        telegramConnectedAt: now,
        telegramLinkToken: null,
        telegramLinkExpires: null,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        telegramNotify24h: true,
        telegramNotify3h: true,
        createdDate: now,
        updatedDate: now,
      });
      await ds.getRepository(StudentEntity).update(studentRes.body.id, {
        userId,
        telegramId: chatId,
      });
    }

    mockTelegram.clear();
    await telegram.handleUpdate({
      update_id: 70,
      message: {
        text: '/start',
        chat: { id: Number(chatId) },
        from: { id: Number(chatId), first_name: 'Menu' },
      },
    });
    expect(
      mockTelegram.sentMessages.some((m) => m.text.includes('✅ Longhua CRM подключён')),
    ).toBe(true);

    mockTelegram.clear();
    await telegram.handleUpdate({
      update_id: 71,
      callback_query: {
        id: 'cb-lessons',
        data: 'menu:lessons',
        from: { id: Number(chatId) },
        message: { chat: { id: Number(chatId) }, message_id: 1 },
      },
    });
    expect(
      mockTelegram.sentMessages.some(
        (m) => m.text.includes('👨‍🏫 Преподаватель:') && m.text.includes('18:30'),
      ),
    ).toBe(true);

    mockTelegram.clear();
    await telegram.handleUpdate({
      update_id: 72,
      callback_query: {
        id: 'cb-settings',
        data: 'menu:settings',
        from: { id: Number(chatId) },
        message: { chat: { id: Number(chatId) }, message_id: 2 },
      },
    });
    expect(
      mockTelegram.sentMessages.some((m) =>
        m.text.includes('Настройки уведомлений'),
      ),
    ).toBe(true);
  });
});
