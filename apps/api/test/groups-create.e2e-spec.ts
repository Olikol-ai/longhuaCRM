import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('Group creation (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    const admin = await adminLogin(app);
    adminToken = admin.token;
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates group with name, teacher and status', async () => {
    const teacher = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Group Teacher ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);

    const groupName = `Group ${randomUUID().slice(0, 8)}`;
    const res = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({ name: groupName, teacherId: teacher.body.id, status: 'active' })
      .expect(201);

    expect(res.body.name).toBe(groupName);
    expect(res.body.teacher_id ?? res.body.teacherId).toBe(teacher.body.id);
    expect(res.body.status).toBe('active');
  });

  it('creates group without teacher when teacherId omitted', async () => {
    const groupName = `Orphan Group ${randomUUID().slice(0, 8)}`;
    const res = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({ name: groupName })
      .expect(201);

    expect(res.body.name).toBe(groupName);
    expect(res.body.teacher_id ?? res.body.teacherId ?? null).toBeNull();
  });

  it('creates group without course and returns workspace', async () => {
    const teacher = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `WS Teacher ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);

    const group = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({
        name: `WS Group ${randomUUID().slice(0, 8)}`,
        teacherId: teacher.body.id,
      })
      .expect(201);

    expect(group.body.course_id ?? group.body.courseId ?? null).toBeNull();

    const workspace = await api(app)
      .get(`/api/groups/${group.body.id}/workspace`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(workspace.body.group?.id ?? workspace.body.group?.id).toBe(group.body.id);
    expect(Array.isArray(workspace.body.members)).toBe(true);
    expect(Array.isArray(workspace.body.lessons)).toBe(true);
    expect(Array.isArray(workspace.body.series)).toBe(true);
  });

  it('updates name/teacher and manages members without deleting students', async () => {
    const teacherA = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `T-A ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);
    const teacherB = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `T-B ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);

    const student = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: `Group Student ${randomUUID().slice(0, 8)}`,
        status: 'active',
      })
      .expect(201);

    const group = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({
        name: `Members Group ${randomUUID().slice(0, 8)}`,
        teacherId: teacherA.body.id,
      })
      .expect(201);

    const renamed = `Renamed ${randomUUID().slice(0, 8)}`;
    const updated = await api(app)
      .patch(`/api/groups/${group.body.id}`)
      .set(authHeader(adminToken))
      .send({ name: renamed, teacherId: teacherB.body.id })
      .expect(200);

    expect(updated.body.name).toBe(renamed);
    expect(updated.body.teacher_id ?? updated.body.teacherId).toBe(teacherB.body.id);

    const member = await api(app)
      .post(`/api/groups/${group.body.id}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: student.body.id })
      .expect(201);

    await api(app)
      .post(`/api/groups/${group.body.id}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: student.body.id })
      .expect(409);

    const list = await api(app)
      .get(`/api/groups/${group.body.id}/members`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(list.body).toHaveLength(1);

    await api(app)
      .delete(`/api/groups/${group.body.id}/members/${member.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    const afterRemove = await api(app)
      .get(`/api/groups/${group.body.id}/members`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(afterRemove.body).toHaveLength(0);

    const studentStill = await api(app)
      .get(`/api/students/${student.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(studentStill.body.id).toBe(student.body.id);
  });

  it('creates lesson series for a group without courseId', async () => {
    const teacher = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Series Teacher ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);

    const student = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: `Series Student ${randomUUID().slice(0, 8)}`,
        status: 'active',
      })
      .expect(201);

    const group = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({
        name: `Series Group ${randomUUID().slice(0, 8)}`,
        teacherId: teacher.body.id,
      })
      .expect(201);

    await api(app)
      .post(`/api/groups/${group.body.id}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: student.body.id })
      .expect(201);

    for (let day = 0; day <= 6; day += 1) {
      await api(app)
        .post('/api/schedule')
        .set(authHeader(adminToken))
        .send({
          teacherId: teacher.body.id,
          dayOfWeek: day,
          timeFrom: '09:00',
          timeTo: '21:00',
        })
        .expect(201);
    }

    const startDate = '2030-03-04'; // Monday
    const series = await api(app)
      .post('/api/lesson-series')
      .set(authHeader(adminToken))
      .send({
        groupId: group.body.id,
        teacherId: teacher.body.id,
        startDate,
        totalLessons: 2,
        duration: 60,
        slots: [{ dayOfWeek: 0, startTime: '18:30' }],
      })
      .expect(201);

    expect(series.body.series?.course_id ?? series.body.series?.courseId ?? null).toBeNull();
    expect(
      Number(series.body.lessons_created ?? series.body.lessonsCreated ?? 0),
    ).toBeGreaterThan(0);

    const workspace = await api(app)
      .get(`/api/groups/${group.body.id}/workspace`)
      .set(authHeader(adminToken))
      .expect(200);
    expect((workspace.body.lessons ?? []).length).toBeGreaterThan(0);
    expect(
      (workspace.body.lessons ?? []).every(
        (lesson: { group_id?: string; groupId?: string }) =>
          (lesson.group_id ?? lesson.groupId) === group.body.id,
      ),
    ).toBe(true);
  });
});
