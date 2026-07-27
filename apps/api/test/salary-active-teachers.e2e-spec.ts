import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  adminLogin,
  api,
  authHeader,
  createTeacherUser,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';
import { TeacherEntity } from '../src/modules/teachers/entities/teacher.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';

describe('Active teachers filtering for salary (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let ds: DataSource;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    ds = app.get(DataSource);
    const admin = await adminLogin(app);
    adminToken = admin.token;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function createStudent(): Promise<string> {
    const res = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Salary Filter Student ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);
    return res.body.id as string;
  }

  it('shows linked active teacher in /teachers/active and salary summary', async () => {
    const suffix = randomUUID().slice(0, 8);
    const teacher = await createTeacherUser(app, adminToken, {
      email: `salary-active-${suffix}@test.local`,
      password: 'TestTeacher123!',
      name: `Active Salary ${suffix}`,
    });

    await api(app)
      .patch(`/api/teachers/${teacher.teacherId}`)
      .set(authHeader(adminToken))
      .send({ hourlyRate: 30 })
      .expect(200);

    const studentId = await createStudent();
    const lesson = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        primaryStudentId: studentId,
        lessonType: 'individual',
        date: '2026-03-10',
        startTime: '10:00',
        duration: 60,
        status: 'planned',
      })
      .expect(201);

    await api(app)
      .patch(`/api/lessons/${lesson.body.id}/complete`)
      .set(authHeader(adminToken))
      .expect(200);

    const active = await api(app)
      .get('/api/teachers/active')
      .set(authHeader(adminToken))
      .expect(200);

    expect(
      (active.body as Array<{ id?: string }>).some((row) => row.id === teacher.teacherId),
    ).toBe(true);

    const summary = await api(app)
      .get('/api/teacher-payments/summary')
      .query({ month: '2026-03' })
      .set(authHeader(adminToken))
      .expect(200);

    expect(
      (summary.body as Array<Record<string, unknown>>).some(
        (row) =>
          (row.teacher_id as string) === teacher.teacherId ||
          (row.teacherId as string) === teacher.teacherId,
      ),
    ).toBe(true);
  });

  it('hides teacher from active list and salary after user deletion', async () => {
    const suffix = randomUUID().slice(0, 8);
    const teacher = await createTeacherUser(app, adminToken, {
      email: `salary-delete-${suffix}@test.local`,
      password: 'TestTeacher123!',
      name: `Delete Salary ${suffix}`,
    });

    await api(app)
      .patch(`/api/teachers/${teacher.teacherId}`)
      .set(authHeader(adminToken))
      .send({ hourlyRate: 25 })
      .expect(200);

    const studentId = await createStudent();
    const lesson = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        primaryStudentId: studentId,
        lessonType: 'individual',
        date: '2026-02-05',
        startTime: '11:00',
        duration: 60,
        status: 'planned',
      })
      .expect(201);

    await api(app)
      .patch(`/api/lessons/${lesson.body.id}/complete`)
      .set(authHeader(adminToken))
      .expect(200);

    await api(app)
      .delete(`/api/users/${teacher.userId}`)
      .set(authHeader(adminToken))
      .expect(200);

    const active = await api(app)
      .get('/api/teachers/active')
      .set(authHeader(adminToken))
      .expect(200);
    expect(
      (active.body as Array<{ id?: string }>).some((row) => row.id === teacher.teacherId),
    ).toBe(false);

    const summary = await api(app)
      .get('/api/teacher-payments/summary')
      .query({ month: '2026-02' })
      .set(authHeader(adminToken))
      .expect(200);
    expect(
      (summary.body as Array<Record<string, unknown>>).some(
        (row) =>
          (row.teacher_id as string) === teacher.teacherId ||
          (row.teacherId as string) === teacher.teacherId,
      ),
    ).toBe(false);

    // Teacher profile removed; financial payment history kept with null teacher_id.
    await api(app).get(`/api/teachers/${teacher.teacherId}`).set(authHeader(adminToken)).expect(404);
  });

  it('does not include admin users in /teachers/active or salary summary', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `salary-admin-${suffix}@test.local`;

    const teacher = await createTeacherUser(app, adminToken, {
      email,
      password: 'TestTeacher123!',
      name: `Was Teacher ${suffix}`,
    });

    await api(app)
      .patch(`/api/teachers/${teacher.teacherId}`)
      .set(authHeader(adminToken))
      .send({ hourlyRate: 15 })
      .expect(200);

    const studentId = await createStudent();
    const lesson = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        primaryStudentId: studentId,
        lessonType: 'individual',
        date: '2026-01-12',
        startTime: '09:00',
        duration: 60,
        status: 'planned',
      })
      .expect(201);

    await api(app)
      .patch(`/api/lessons/${lesson.body.id}/complete`)
      .set(authHeader(adminToken))
      .expect(200);

    // Promote to admin → RoleEntitySync detaches Teacher (inactive, user_id null).
    await api(app)
      .patch(`/api/users/${teacher.userId}`)
      .set(authHeader(adminToken))
      .send({ role: 'admin' })
      .expect(200);

    const active = await api(app)
      .get('/api/teachers/active')
      .set(authHeader(adminToken))
      .expect(200);
    expect(
      (active.body as Array<{ id?: string; user_id?: string; userId?: string }>).some(
        (row) =>
          row.id === teacher.teacherId ||
          row.user_id === teacher.userId ||
          row.userId === teacher.userId,
      ),
    ).toBe(false);

    const summary = await api(app)
      .get('/api/teacher-payments/summary')
      .query({ month: '2026-01' })
      .set(authHeader(adminToken))
      .expect(200);

    expect(
      (summary.body as Array<Record<string, unknown>>).some(
        (row) =>
          (row.teacher_id as string) === teacher.teacherId ||
          (row.teacherId as string) === teacher.teacherId,
      ),
    ).toBe(false);
  });

  it('does not include pending users in /teachers/active', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `salary-pending-${suffix}@test.local`;

    const teacher = await createTeacherUser(app, adminToken, {
      email,
      password: 'TestTeacher123!',
      name: `Pending Salary ${suffix}`,
    });

    // Simulate bad state: teacher profile still active, user pending.
    await ds.getRepository(UserEntity).update(teacher.userId, {
      status: 'pending',
      role: 'teacher',
    });
    await ds.getRepository(TeacherEntity).update(teacher.teacherId, {
      status: 'active',
      userId: teacher.userId,
    });

    const active = await api(app)
      .get('/api/teachers/active')
      .set(authHeader(adminToken))
      .expect(200);

    expect(
      (active.body as Array<{ id?: string }>).some((row) => row.id === teacher.teacherId),
    ).toBe(false);

    // Cleanup dirty fixture so later consistency checks stay green.
    await ds.getRepository(TeacherEntity).update(teacher.teacherId, {
      status: 'inactive',
      userId: null,
    });
    await ds.getRepository(UserEntity).update(teacher.userId, {
      status: 'blocked',
      role: '',
    });
  });

  it('migration repair leaves no active teachers without valid users', async () => {
    const orphans = await ds.query(`
      SELECT t.id
      FROM teachers t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.status = 'active'
        AND (
          t.user_id IS NULL
          OR u.id IS NULL
          OR COALESCE(u.role, '') <> 'teacher'
          OR COALESCE(u.status, '') <> 'active'
        )
    `);
    expect(orphans).toEqual([]);
  });
});
