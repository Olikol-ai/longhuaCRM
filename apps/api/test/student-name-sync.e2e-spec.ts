import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
  futureLessonDate,
} from './e2e-helpers';
import { StudentEntity } from '../src/modules/students/entities/student.entity';
import { TeacherEntity } from '../src/modules/teachers/entities/teacher.entity';
import {
  LessonConfirmationEntity,
  LessonConfirmationStatus,
} from '../src/modules/lesson-confirmations/entities/lesson-confirmation.entity';
import { LessonConfirmationJobsService } from '../src/modules/lesson-confirmations/lesson-confirmation-jobs.service';
import { MockTelegramGateway } from '../src/modules/telegram/mock-telegram.gateway';
import { TelegramService } from '../src/modules/telegram/telegram.service';

const OLD_LAST = 'Баабева';
const NEW_LAST = 'Бабаева';

function assertNoOldName(value: unknown) {
  const text = String(value ?? '');
  expect(text).toContain(NEW_LAST);
  expect(text).not.toMatch(new RegExp(OLD_LAST, 'i'));
  expect(text).not.toMatch(/баабева/i);
}

/** Local wall-clock date/time ~hoursFromNow (matches confirmation job window). */
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

describe('Student name display sync (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let ds: DataSource;
  let mockTelegram: MockTelegramGateway;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    ds = app.get(DataSource);
    mockTelegram = app.get(MockTelegramGateway);
    const admin = await adminLogin(app);
    adminToken = admin.token;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    mockTelegram.clear();
  });

  it('admin rename updates card, schedule, lesson, attendance and Telegram', async () => {
    const suffix = randomUUID().slice(0, 8);
    const teacherChatId = String(960000000 + Math.floor(Math.random() * 99999));
    const studentChatId = String(970000000 + Math.floor(Math.random() * 99999));

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: `${OLD_LAST} Наталья ${suffix}`,
        status: 'active',
        telegramId: studentChatId,
      });
    expect(studentRes.status).toBe(201);
    const studentId = studentRes.body.id as string;

    // Historical desync: admin card name fixed, first/last left stale.
    await ds.getRepository(StudentEntity).update(studentId, {
      name: `${NEW_LAST} Наталья ${suffix}`,
      lastName: OLD_LAST,
      firstName: `Наталья ${suffix}`,
    });

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({
        name: `Name Sync Teacher ${suffix}`,
        status: 'active',
        hourlyRate: 25,
        telegramId: teacherChatId,
      });
    expect(teacherRes.status).toBe(201);
    const teacherId = teacherRes.body.id as string;
    await ds.getRepository(TeacherEntity).update(teacherId, {
      telegramId: teacherChatId,
    });

    const scheduleDate = futureLessonDate(5);
    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: scheduleDate,
        startTime: '10:00',
        duration: 60,
        status: 'planned',
        lessonType: 'individual',
      });
    expect(lessonRes.status).toBe(201);
    const lessonId = lessonRes.body.id as string;

    // Even with stale first/last, API labels must use Student.name.
    const beforeRename = await api(app)
      .post('/api/lessons/filter')
      .set(authHeader(adminToken))
      .send({ where: { id: lessonId } });
    expect(beforeRename.status).toBe(201);
    const beforeLesson = (beforeRename.body as Array<Record<string, unknown>>).find(
      (row) => row.id === lessonId,
    );
    assertNoOldName(beforeLesson?.student_name ?? beforeLesson?.studentName);

    const renameRes = await api(app)
      .patch(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .send({ name: `${NEW_LAST} Наталья ${suffix}` });
    expect(renameRes.status).toBe(200);
    expect(renameRes.body.name).toBe(`${NEW_LAST} Наталья ${suffix}`);
    expect(renameRes.body.last_name ?? renameRes.body.lastName).toBe(NEW_LAST);

    const cardRes = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken));
    expect(cardRes.status).toBe(200);
    assertNoOldName(cardRes.body.name);

    const lessonsRes = await api(app)
      .post('/api/lessons/filter')
      .set(authHeader(adminToken))
      .send({ where: { id: lessonId } });
    expect(lessonsRes.status).toBe(201);
    const lesson = (lessonsRes.body as Array<Record<string, unknown>>).find(
      (row) => row.id === lessonId,
    );
    assertNoOldName(lesson?.student_name ?? lesson?.studentName);

    const scheduleRes = await api(app)
      .post('/api/lessons/filter')
      .set(authHeader(adminToken))
      .send({
        where: {
          teacher_id: teacherId,
          date: scheduleDate,
        },
      });
    expect(scheduleRes.status).toBe(201);
    const scheduleLesson = (scheduleRes.body as Array<Record<string, unknown>>).find(
      (row) => row.id === lessonId,
    );
    assertNoOldName(scheduleLesson?.student_name ?? scheduleLesson?.studentName);

    const attendanceRes = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });
    expect(attendanceRes.status).toBe(201);
    expect(Array.isArray(attendanceRes.body)).toBe(true);
    expect(attendanceRes.body.length).toBeGreaterThan(0);
    for (const row of attendanceRes.body as Array<Record<string, unknown>>) {
      assertNoOldName(row.student_name ?? row.studentName);
    }

    // Telegram: 3h confirmation → student confirms → teacher sees Student.name SSOT.
    const slot = lessonSlotInHours(3.05);
    const tgLessonRes = await api(app)
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
      });
    expect(tgLessonRes.status).toBe(201);
    const tgLessonId = tgLessonRes.body.id as string;

    await app.get(LessonConfirmationJobsService).runSendPendingLessonConfirmations();
    const pending = await ds.getRepository(LessonConfirmationEntity).findOneOrFail({
      where: { lessonId: tgLessonId, studentId },
    });

    mockTelegram.clear();
    await app.get(TelegramService).handleUpdate({
      update_id: 91001,
      callback_query: {
        id: `cb-name-sync-${suffix}`,
        data: `lesson_confirm:${pending.id}`,
        from: { id: Number(studentChatId) },
        message: { chat: { id: Number(studentChatId) }, message_id: 501 },
      },
    });

    const confirmed = await ds.getRepository(LessonConfirmationEntity).findOneOrFail({
      where: { id: pending.id },
    });
    expect(confirmed.status).toBe(LessonConfirmationStatus.CONFIRMED);

    const teacherMsg = mockTelegram.sentMessages.find(
      (m) => m.chatId === teacherChatId && /подтвердил/i.test(m.text),
    );
    expect(teacherMsg).toBeTruthy();
    assertNoOldName(teacherMsg?.text);
  });
});
