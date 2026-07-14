import { INestApplication } from '@nestjs/common';
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
import {
  LessonConfirmationEntity,
  LessonConfirmationStatus,
} from '../src/modules/lesson-confirmations/entities/lesson-confirmation.entity';
import { LessonConfirmationJobsService } from '../src/modules/lesson-confirmations/lesson-confirmation-jobs.service';
import { MockTelegramGateway } from '../src/modules/telegram/mock-telegram.gateway';
import { TelegramService } from '../src/modules/telegram/telegram.service';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

/** Local wall-clock date/time ~hoursFromNow (matches job Date arithmetic). */
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

describeE2E('Lesson confirmation 3h flow (e2e)', () => {
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

  async function seedStudentTeacher(chatId: string) {
    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: 'Confirm 3h Student',
        email: `c3h-${randomUUID().slice(0, 8)}@test.local`,
        telegramId: chatId,
      })
      .expect(201);

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({
        name: 'Confirm 3h Teacher',
        email: `c3h-t-${randomUUID().slice(0, 8)}@test.local`,
      })
      .expect(201);

    return { studentId: studentRes.body.id as string, teacherId: teacherRes.body.id as string };
  }

  it('job creates confirmation and sends Telegram for lesson in ~3h window', async () => {
    const chatId = String(950000000 + Math.floor(Math.random() * 99999));
    const { studentId, teacherId } = await seedStudentTeacher(chatId);
    const slot = lessonSlotInHours(3);

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: slot.date,
        startTime: slot.startTime,
        duration: 60,
        status: 'planned',
        lessonType: 'individual',
      })
      .expect(201);

    const jobs = app.get(LessonConfirmationJobsService);
    const first = await jobs.runSendPendingLessonConfirmations();
    expect(first.sent).toBeGreaterThanOrEqual(1);

    const ds = app.get(DataSource);
    const row = await ds.getRepository(LessonConfirmationEntity).findOneOrFail({
      where: { lessonId: lessonRes.body.id, studentId },
    });
    expect(row.status).toBe(LessonConfirmationStatus.PENDING);
    expect(row.telegramChatId).toBe(chatId);
    expect(row.requestedAt).toBeTruthy();
    expect(
      mockTelegram.sentMessages.some(
        (m) =>
          m.chatId === chatId
          && m.text.includes('⏰ Через 3 часа начинается урок'),
      ),
    ).toBe(true);

    const second = await jobs.runSendPendingLessonConfirmations();
    expect(second.sent).toBe(0);

    const count = await ds.getRepository(LessonConfirmationEntity).count({
      where: { lessonId: lessonRes.body.id, studentId },
    });
    expect(count).toBe(1);
  });

  it('callback confirm sets CONFIRMED', async () => {
    const chatId = String(951000000 + Math.floor(Math.random() * 99999));
    const { studentId, teacherId } = await seedStudentTeacher(chatId);
    const slot = lessonSlotInHours(3.05);

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: slot.date,
        startTime: slot.startTime,
        duration: 60,
        status: 'planned',
        lessonType: 'individual',
      })
      .expect(201);

    await app.get(LessonConfirmationJobsService).runSendPendingLessonConfirmations();
    const ds = app.get(DataSource);
    const pending = await ds.getRepository(LessonConfirmationEntity).findOneOrFail({
      where: { lessonId: lessonRes.body.id, studentId },
    });

    await app.get(TelegramService).handleUpdate({
      update_id: 10,
      callback_query: {
        id: 'cb-confirm',
        data: `lesson_confirm:${pending.id}`,
        from: { id: Number(chatId) },
        message: { chat: { id: Number(chatId) } },
      },
    });

    const row = await ds.getRepository(LessonConfirmationEntity).findOneOrFail({
      where: { id: pending.id },
    });
    expect(row.status).toBe(LessonConfirmationStatus.CONFIRMED);
    expect(row.confirmedAt).toBeTruthy();
    expect(
      mockTelegram.sentMessages.some((m) => m.text.includes('Участие подтверждено')),
    ).toBe(true);
  });

  it('callback decline sets DECLINED immediately', async () => {
    const chatId = String(952000000 + Math.floor(Math.random() * 99999));
    const { studentId, teacherId } = await seedStudentTeacher(chatId);
    const slot = lessonSlotInHours(2.95);

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: slot.date,
        startTime: slot.startTime,
        duration: 60,
        status: 'planned',
        lessonType: 'individual',
      })
      .expect(201);

    await app.get(LessonConfirmationJobsService).runSendPendingLessonConfirmations();
    const ds = app.get(DataSource);
    const pending = await ds.getRepository(LessonConfirmationEntity).findOneOrFail({
      where: { lessonId: lessonRes.body.id, studentId },
    });

    const telegram = app.get(TelegramService);
    await telegram.handleUpdate({
      update_id: 20,
      callback_query: {
        id: 'cb-decline',
        data: `lesson_decline:${pending.id}`,
        from: { id: Number(chatId) },
        message: { chat: { id: Number(chatId) } },
      },
    });

    const row = await ds.getRepository(LessonConfirmationEntity).findOneOrFail({
      where: { id: pending.id },
    });
    expect(row.status).toBe(LessonConfirmationStatus.DECLINED);
    expect(row.declinedAt).toBeTruthy();
    expect(
      mockTelegram.sentMessages.some((m) =>
        m.text.includes('Урок отменён. Информация передана администратору.'),
      ),
    ).toBe(true);
  });

  it('stale confirm button returns friendly already-confirmed message', async () => {
    const chatId = String(954000000 + Math.floor(Math.random() * 99999));
    const { studentId, teacherId } = await seedStudentTeacher(chatId);
    const slot = lessonSlotInHours(3.02);

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: slot.date,
        startTime: slot.startTime,
        duration: 60,
        status: 'planned',
        lessonType: 'individual',
      })
      .expect(201);

    await app.get(LessonConfirmationJobsService).runSendPendingLessonConfirmations();
    const ds = app.get(DataSource);
    const pending = await ds.getRepository(LessonConfirmationEntity).findOneOrFail({
      where: { lessonId: lessonRes.body.id, studentId },
    });

    const telegram = app.get(TelegramService);
    await telegram.handleUpdate({
      update_id: 30,
      callback_query: {
        id: 'cb-confirm-1',
        data: `lesson_confirm:${pending.id}`,
        from: { id: Number(chatId) },
        message: { chat: { id: Number(chatId) } },
      },
    });

    mockTelegram.clear();
    await telegram.handleUpdate({
      update_id: 31,
      callback_query: {
        id: 'cb-confirm-2',
        data: `lesson_confirm:${pending.id}`,
        from: { id: Number(chatId) },
        message: { chat: { id: Number(chatId) } },
      },
    });

    expect(
      mockTelegram.sentMessages.some((m) => m.text.includes('уже подтверждён')),
    ).toBe(true);
  });

  it('admin send-test-confirmation creates and sends message', async () => {
    const chatId = String(953000000 + Math.floor(Math.random() * 99999));
    const { studentId, teacherId } = await seedStudentTeacher(chatId);
    const slot = lessonSlotInHours(5);

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: slot.date,
        startTime: slot.startTime,
        duration: 60,
        status: 'planned',
        lessonType: 'individual',
      })
      .expect(201);

    const res = await api(app)
      .post('/api/telegram/admin/send-test-confirmation')
      .set(authHeader(adminToken))
      .send({ studentId, lessonId: lessonRes.body.id })
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(res.body.confirmation.status).toBe(LessonConfirmationStatus.PENDING);
    expect(
      mockTelegram.sentMessages.some((m) => m.chatId === chatId),
    ).toBe(true);
  });
});
