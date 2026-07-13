import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { MaterialAccessEntity } from '../src/modules/materials/entities/material-access.entity';
import { MaterialCourseGrantEntity } from '../src/modules/materials/entities/material-course-grant.entity';
import { MaterialGroupGrantEntity } from '../src/modules/materials/entities/material-group-grant.entity';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
  login,
} from './e2e-helpers';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

async function createStudentUser(
  app: INestApplication,
  adminToken: string,
  label: string,
): Promise<{ studentId: string; userId: string; token: string; email: string }> {
  const ds = app.get(DataSource);
  const userId = randomUUID();
  const email = `${label}-${randomUUID().slice(0, 8)}@test.local`;
  const password = 'StudentPass123!';
  const now = new Date();

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
    firstName: 'Access',
    lastName: 'Student',
    phone: '',
    telegramId: '',
    telegramUsername: '',
    telegramLinkToken: null,
    telegramLinkExpires: null,
    createdDate: now,
    updatedDate: now,
  });

  const studentRes = await api(app)
    .post('/api/students')
    .set(authHeader(adminToken))
    .send({ name: `Access Student ${label}`, userId, status: 'active' })
    .expect(201);

  const session = await login(app, email, password);
  return {
    studentId: studentRes.body.id,
    userId,
    token: session.token,
    email,
  };
}

async function seedMaterialAwayFromStudent(
  app: INestApplication,
  adminToken: string,
  title: string,
): Promise<{ materialId: string; folderCourseId: string }> {
  const courseRes = await api(app)
    .post('/api/courses')
    .set(authHeader(adminToken))
    .send({
      name: `Access Library ${randomUUID().slice(0, 8)}`,
      courseType: 'basic_beginner',
      totalLessons: 8,
    })
    .expect(201);

  const folderRes = await api(app)
    .post('/api/materials/folders')
    .set(authHeader(adminToken))
    .send({
      name: `Access Folder ${randomUUID().slice(0, 8)}`,
      courseTemplateId: courseRes.body.id,
      sortOrder: 0,
    })
    .expect(201);

  const materialRes = await api(app)
    .post('/api/materials')
    .set(authHeader(adminToken))
    .send({
      folderId: folderRes.body.id,
      title,
      fileType: 'pdf',
      description: 'access e2e',
    })
    .expect(201);

  return {
    materialId: materialRes.body.id,
    folderCourseId: courseRes.body.id,
  };
}

describeE2E('Materials access grants (e2e)', () => {
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

  it('admin grants to student; student sees material; other student does not', async () => {
    const title = `Personal Grant ${randomUUID().slice(0, 8)}`;
    const { materialId } = await seedMaterialAwayFromStudent(app, adminToken, title);
    const studentA = await createStudentUser(app, adminToken, 'pers-a');
    const studentB = await createStudentUser(app, adminToken, 'pers-b');

    const beforeA = await api(app)
      .get('/api/materials')
      .set(authHeader(studentA.token))
      .expect(200);
    expect(beforeA.body.some((row: { id: string }) => row.id === materialId)).toBe(false);

    await api(app)
      .post('/api/materials/access/grant')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'student',
        targetId: studentA.studentId,
        grantedByRole: 'ADMIN',
      })
      .expect(201);

    const afterA = await api(app)
      .get('/api/materials')
      .set(authHeader(studentA.token))
      .expect(200);
    expect(afterA.body.some((row: { id: string }) => row.id === materialId)).toBe(true);

    const afterB = await api(app)
      .get('/api/materials')
      .set(authHeader(studentB.token))
      .expect(200);
    expect(afterB.body.some((row: { id: string }) => row.id === materialId)).toBe(false);

    const checkA = await api(app)
      .get(`/api/materials/access/check/${materialId}`)
      .set(authHeader(studentA.token))
      .expect(200);
    expect(checkA.body.has_access).toBe(true);

    const checkB = await api(app)
      .get(`/api/material-access/check/${materialId}`)
      .set(authHeader(studentB.token))
      .expect(200);
    expect(checkB.body.has_access).toBe(false);

    const grants = await api(app)
      .get(`/api/materials/access/material/${materialId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(grants.body.personal?.length).toBeGreaterThanOrEqual(1);
    expect(grants.body.personal[0].label).toBe('Персональный доступ');

    const studentMaterials = await api(app)
      .get('/api/materials')
      .set(authHeader(studentA.token))
      .expect(200);
    const row = studentMaterials.body.find((item: { id: string }) => item.id === materialId);
    expect(row?.access_sources?.some((s: { type: string }) => s.type === 'personal')).toBe(true);
  });

  it('group grant gives access to members only', async () => {
    const title = `Group Grant ${randomUUID().slice(0, 8)}`;
    const { materialId } = await seedMaterialAwayFromStudent(app, adminToken, title);
    const member = await createStudentUser(app, adminToken, 'grp-m');
    const outsider = await createStudentUser(app, adminToken, 'grp-o');

    const teacher = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Access Teacher ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);

    const group = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({
        name: `Access Group ${randomUUID().slice(0, 8)}`,
        teacherId: teacher.body.id,
        status: 'active',
      })
      .expect(201);

    await api(app)
      .post(`/api/groups/${group.body.id}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: member.studentId })
      .expect(201);

    await api(app)
      .post('/api/materials/access/grant')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'group',
        targetId: group.body.id,
        grantedByRole: 'ADMIN',
      })
      .expect(201);

    const memberList = await api(app)
      .get('/api/materials')
      .set(authHeader(member.token))
      .expect(200);
    expect(memberList.body.some((row: { id: string }) => row.id === materialId)).toBe(true);

    const outsiderList = await api(app)
      .get('/api/materials')
      .set(authHeader(outsider.token))
      .expect(200);
    expect(outsiderList.body.some((row: { id: string }) => row.id === materialId)).toBe(false);
  });

  it('course grant gives access to enrolled students only', async () => {
    const title = `Course Grant ${randomUUID().slice(0, 8)}`;
    const { materialId } = await seedMaterialAwayFromStudent(app, adminToken, title);
    const enrolled = await createStudentUser(app, adminToken, 'crs-e');
    const notEnrolled = await createStudentUser(app, adminToken, 'crs-n');

    const targetCourse = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({
        name: `Grant Target ${randomUUID().slice(0, 8)}`,
        courseType: 'basic_beginner',
        totalLessons: 5,
      })
      .expect(201);

    await api(app)
      .post('/api/courses/enrollments')
      .set(authHeader(adminToken))
      .send({
        studentId: enrolled.studentId,
        courseTemplateId: targetCourse.body.id,
        totalLessons: 5,
        status: 'active',
      })
      .expect(201);

    await api(app)
      .post('/api/materials/access/grant')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'course',
        targetId: targetCourse.body.id,
        grantedByRole: 'ADMIN',
      })
      .expect(201);

    const enrolledList = await api(app)
      .get('/api/materials')
      .set(authHeader(enrolled.token))
      .expect(200);
    expect(enrolledList.body.some((row: { id: string }) => row.id === materialId)).toBe(true);

    const otherList = await api(app)
      .get('/api/materials')
      .set(authHeader(notEnrolled.token))
      .expect(200);
    expect(otherList.body.some((row: { id: string }) => row.id === materialId)).toBe(false);
  });

  it('re-grant does not create duplicate personal rows; revoke removes access', async () => {
    const title = `Dup Grant ${randomUUID().slice(0, 8)}`;
    const { materialId } = await seedMaterialAwayFromStudent(app, adminToken, title);
    const student = await createStudentUser(app, adminToken, 'dup');

    const first = await api(app)
      .post('/api/materials/access/grant')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'user',
        targetId: student.userId,
        grantedByRole: 'ADMIN',
      })
      .expect(201);
    expect(first.body.granted_count ?? first.body.grantedCount).toBe(1);

    const second = await api(app)
      .post('/api/materials/access/grant')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'user',
        targetId: student.userId,
        grantedByRole: 'ADMIN',
      })
      .expect(201);
    expect(second.body.granted_count ?? second.body.grantedCount).toBe(0);
    expect(second.body.skipped_count ?? second.body.skippedCount).toBe(1);

    const ds = app.get(DataSource);
    const rows = await ds.getRepository(MaterialAccessEntity).find({
      where: { userId: student.userId, materialId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].access).toBe(true);

    await api(app)
      .post('/api/materials/access/revoke')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'user',
        targetId: student.userId,
      })
      .expect(201);

    const afterRevoke = await ds.getRepository(MaterialAccessEntity).findOne({
      where: { userId: student.userId, materialId },
    });
    expect(afterRevoke?.access).toBe(false);

    const list = await api(app)
      .get('/api/materials')
      .set(authHeader(student.token))
      .expect(200);
    expect(list.body.some((row: { id: string }) => row.id === materialId)).toBe(false);
  });

  it('lists explicit recipients and does not duplicate course/group grants', async () => {
    const title = `Recipients ${randomUUID().slice(0, 8)}`;
    const { materialId } = await seedMaterialAwayFromStudent(app, adminToken, title);

    const course = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({
        name: `Rec Course ${randomUUID().slice(0, 8)}`,
        courseType: 'basic_beginner',
        totalLessons: 3,
      })
      .expect(201);

    const group = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({ name: `Rec Group ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);

    await api(app)
      .post('/api/materials/access/grant')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'course',
        targetId: course.body.id,
      })
      .expect(201);

    await api(app)
      .post('/api/materials/access/grant')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'course',
        targetId: course.body.id,
      })
      .expect(201);

    await api(app)
      .post('/api/materials/access/grant')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'group',
        targetId: group.body.id,
      })
      .expect(201);

    await api(app)
      .post('/api/materials/access/grant')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'group',
        targetId: group.body.id,
      })
      .expect(201);

    const ds = app.get(DataSource);
    const courseGrants = await ds.getRepository(MaterialCourseGrantEntity).find({
      where: { materialId, courseTemplateId: course.body.id },
    });
    expect(courseGrants).toHaveLength(1);

    const groupGrants = await ds.getRepository(MaterialGroupGrantEntity).find({
      where: { materialId, groupId: group.body.id },
    });
    expect(groupGrants).toHaveLength(1);

    const recipients = await api(app)
      .get(`/api/materials/access/material/${materialId}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(recipients.body.course_template_ids).toContain(course.body.id);
    expect(recipients.body.group_ids).toContain(group.body.id);

    await api(app)
      .post('/api/materials/access/revoke')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'course',
        targetId: course.body.id,
      })
      .expect(201);

    await api(app)
      .post('/api/materials/access/revoke')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'group',
        targetId: group.body.id,
      })
      .expect(201);

    const after = await api(app)
      .get(`/api/materials/access/material/${materialId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(after.body.course_template_ids).not.toContain(course.body.id);
    expect(after.body.group_ids).not.toContain(group.body.id);
  });
});
