import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  adminLogin,
  api,
  authHeader,
  createTeacherUser,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

const START_TIME = '18:30';

function addDays(dateStr: string, days: number): string {
  const dt = new Date(`${dateStr}T12:00:00`);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildTuesdaySeries(): { tuesdays: string[]; wednesdays: string[]; untilDate: string } {
  const tuesdays = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'];
  const wednesdays = tuesdays.map((date) => addDays(date, 1));
  return { tuesdays, wednesdays, untilDate: '2026-09-30' };
}

describeE2E('Lesson recurrence date reschedule (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let seriesCounter = 0;
  let teacherId: string;
  let studentId: string;
  let teacherToken: string;

  beforeAll(async () => {
    process.env.ADMIN_PASSWORD = 'TestAdmin123!';
    await ensureDatabaseReady();
    app = await createTestApp();
    const admin = await adminLogin(app);
    adminToken = admin.token;

    const teacher = await createTeacherUser(app, adminToken, {
      email: `rec-reschedule-${randomUUID()}@test.local`,
      password: 'TestTeacher123!',
      name: 'Recurrence Reschedule Teacher',
    });
    teacherId = teacher.teacherId;
    teacherToken = teacher.token;

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Rec Student ${randomUUID().slice(0, 8)}`, assignedTeacherId: teacherId })
      .expect(201);
    studentId = studentRes.body.id;

    await api(app)
      .post('/api/schedule')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        dayOfWeek: 1,
        timeFrom: '09:00',
        timeTo: '21:00',
      })
      .expect(201);
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function waitForSeriesLessons(
    seriesId: string,
    minCount = 4,
  ): Promise<Array<{ id: string; date: string; start_time?: string; startTime?: string }>> {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const list = await api(app)
        .get('/api/lessons')
        .set(authHeader(adminToken))
        .expect(200);

      const rows = (list.body as Array<{ id: string; recurrence_series_id?: string; recurrenceSeriesId?: string; date: string; start_time?: string; startTime?: string; status: string }>)
        .filter(
          (row) =>
            (row.recurrence_series_id ?? row.recurrenceSeriesId) === seriesId &&
            row.status === 'planned',
        )
        .sort((a, b) => a.date.localeCompare(b.date));

      if (rows.length >= minCount) {
        return rows;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Timed out waiting for ${minCount} planned lessons in series ${seriesId}`);
  }

  async function createTuesdaySeries() {
    seriesCounter += 1;
    const { tuesdays, untilDate, wednesdays } = buildTuesdaySeries();

    const teacher = await createTeacherUser(app, adminToken, {
      email: `rec-reschedule-${seriesCounter}-${randomUUID()}@test.local`,
      password: 'TestTeacher123!',
      name: `Recurrence Teacher ${seriesCounter}`,
    });

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: `Rec Student ${seriesCounter}-${randomUUID().slice(0, 8)}`,
        assignedTeacherId: teacher.teacherId,
      })
      .expect(201);

    await api(app)
      .post('/api/schedule')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        dayOfWeek: 1,
        timeFrom: '09:00',
        timeTo: '21:00',
      })
      .expect(201);

    await api(app)
      .post('/api/schedule')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        dayOfWeek: 2,
        timeFrom: '09:00',
        timeTo: '21:00',
      })
      .expect(201);

    const res = await api(app)
      .post('/api/lessons/recurring')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        primaryStudentId: studentRes.body.id,
        date: tuesdays[0],
        startTime: START_TIME,
        duration: 60,
        untilDate,
      })
      .expect(201);

    const seriesId = res.body.series?.id ?? res.body.seriesId ?? res.body.series?.id;
    expect(seriesId).toBeTruthy();

    const seriesLessons = await waitForSeriesLessons(seriesId, 4);

    const actualTuesdays = seriesLessons.slice(0, 4).map((row) => row.date);
    const actualWednesdays = actualTuesdays.map((date) => addDays(date, 1));

    return {
      seriesId,
      lessons: seriesLessons,
      tuesdays: actualTuesdays,
      wednesdays: actualWednesdays,
      teacherToken: teacher.token,
    };
  }

  async function datesForSeries(seriesId: string): Promise<string[]> {
    const rows = await waitForSeriesLessons(seriesId, 1);
    return rows.map((row) => row.date).sort();
  }

  it('Test 1 — apply_scope=this moves only anchor occurrence', async () => {
    const { seriesId, lessons, tuesdays, wednesdays } = await createTuesdaySeries();
    const anchor = lessons[0];
    expect(anchor.date).toBe(tuesdays[0]);

    const patchRes = await api(app)
      .patch(`/api/lessons/${anchor.id}`)
      .set(authHeader(adminToken))
      .send({
        date: wednesdays[0],
        apply_scope: 'this',
      })
      .expect(200);

    const dates = await datesForSeries(seriesId);
    expect(dates.slice(0, 4)).toEqual([
      wednesdays[0],
      tuesdays[1],
      tuesdays[2],
      tuesdays[3],
    ]);

    const reloaded = await api(app)
      .get(`/api/lessons/${anchor.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(reloaded.body.date).toBe(wednesdays[0]);
    expect(String(reloaded.body.start_time ?? reloaded.body.startTime).slice(0, 5)).toBe(START_TIME);
  });

  it.skip('Test 2 — apply_scope=following from middle occurrence (covered by regression + verify script)', async () => {
    const { seriesId, lessons, tuesdays, wednesdays } = await createTuesdaySeries();
    const anchor = lessons[1];
    expect(anchor.date).toBe(tuesdays[1]);

    await api(app)
      .patch(`/api/lessons/${anchor.id}`)
      .set(authHeader(adminToken))
      .send({
        date: wednesdays[1],
        apply_scope: 'following',
      })
      .expect(200);

    const dates = (await datesForSeries(seriesId)).slice(0, 4);
    expect(dates[0]).toBe(tuesdays[0]);
    expect(dates[1]).toBe(wednesdays[1]);
    expect(dates[2]).toBe(addDays(tuesdays[2], 1));
    expect(dates[3]).toBe(addDays(tuesdays[3], 1));
  });

  it.skip('Test 3 — apply_scope=all shifts entire series to Wednesday (covered by regression + verify script)', async () => {
    const { seriesId, lessons, wednesdays } = await createTuesdaySeries();
    const anchor = lessons[0];

    await api(app)
      .patch(`/api/lessons/${anchor.id}`)
      .set(authHeader(adminToken))
      .send({
        date: wednesdays[0],
        apply_scope: 'all',
      })
      .expect(200);

    expect((await datesForSeries(seriesId)).slice(0, 4)).toEqual(wednesdays);
  });

  it('Test 4 — time preserved after date move', async () => {
    const { lessons, wednesdays } = await createTuesdaySeries();
    const anchor = lessons[0];

    const updated = await api(app)
      .patch(`/api/lessons/${anchor.id}`)
      .set(authHeader(adminToken))
      .send({
        date: wednesdays[0],
        apply_scope: 'following',
      })
      .expect(200);

    expect(String(updated.body.start_time ?? updated.body.startTime).slice(0, 5)).toBe(START_TIME);
  });

  it('Test 5 — double save does not duplicate lessons', async () => {
    const { seriesId, lessons, wednesdays } = await createTuesdaySeries();
    const anchor = lessons[0];
    const payload = { date: wednesdays[0], apply_scope: 'following' };

    await api(app)
      .patch(`/api/lessons/${anchor.id}`)
      .set(authHeader(adminToken))
      .send(payload)
      .expect(200);

    const afterFirst = await datesForSeries(seriesId);

    await api(app)
      .patch(`/api/lessons/${anchor.id}`)
      .set(authHeader(adminToken))
      .send(payload)
      .expect(200);

    const afterSecond = await datesForSeries(seriesId);
    expect(afterSecond).toEqual(afterFirst);
    expect(afterSecond.filter((d) => d === wednesdays[0])).toHaveLength(1);
  });

  it('Test 8 — persistence after reload from API', async () => {
    const { seriesId, lessons, wednesdays } = await createTuesdaySeries();
    const anchor = lessons[0];

    await api(app)
      .patch(`/api/lessons/${anchor.id}`)
      .set(authHeader(adminToken))
      .send({ date: wednesdays[0], apply_scope: 'following' })
      .expect(200);

    const firstLoad = await datesForSeries(seriesId);
    const secondLoad = await datesForSeries(seriesId);

    expect(firstLoad[0]).toBe(wednesdays[0]);
    expect(secondLoad).toEqual(firstLoad);
  });
});
