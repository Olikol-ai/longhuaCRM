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

const CANVA_URL = 'https://www.canva.com/design/DAGe2e-regression/view';

describeE2E('Canva material access (e2e)', () => {
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

  it('Teacher A and Teacher B with ACL receive the same Canva URL (not signed, not filtered)', async () => {
    const teacherA = await createTeacherUser(app, adminToken, {
      email: `canva-a-${randomUUID()}@test.local`,
      password: 'TeacherPass123!',
      name: 'Canva Teacher A',
    });
    const teacherB = await createTeacherUser(app, adminToken, {
      email: `canva-b-${randomUUID()}@test.local`,
      password: 'TeacherPass123!',
      name: 'Canva Teacher B',
    });

    const courseRes = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({
        name: `Canva Course ${randomUUID().slice(0, 8)}`,
        courseType: 'basic_beginner',
        totalLessons: 8,
      })
      .expect(201);

    const folderRes = await api(app)
      .post('/api/materials/folders')
      .set(authHeader(teacherA.token))
      .send({
        name: 'Canva Folder',
        courseTemplateId: courseRes.body.id,
      })
      .expect(201);

    const created = await api(app)
      .post('/api/materials')
      .set(authHeader(teacherA.token))
      .send({
        title: `Canva Design ${randomUUID().slice(0, 6)}`,
        folderId: folderRes.body.id,
        fileType: 'canva',
        fileUrl: CANVA_URL,
      })
      .expect(201);

    const materialId = created.body.id as string;
    expect(created.body.file_url).toBe(CANVA_URL);

    await api(app)
      .post('/api/materials/access/grant')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'user',
        targetId: teacherB.userId,
        grantedByRole: 'ADMIN',
      })
      .expect(201);

    const [rowA, rowB] = await Promise.all([
      api(app).get(`/api/materials/${materialId}`).set(authHeader(teacherA.token)).expect(200),
      api(app).get(`/api/materials/${materialId}`).set(authHeader(teacherB.token)).expect(200),
    ]);

    expect(rowA.body.file_url).toBe(CANVA_URL);
    expect(rowB.body.file_url).toBe(CANVA_URL);
    expect(rowA.body.file_url).toBe(rowB.body.file_url);
    expect(String(rowA.body.file_url)).not.toMatch(/\/api\/files\/signed\//);
    expect(String(rowB.body.file_url)).not.toMatch(/\/api\/files\/signed\//);

    const [openA, openB] = await Promise.all([
      api(app)
        .get(`/api/files/material/${materialId}/url`)
        .set(authHeader(teacherA.token))
        .expect(200),
      api(app)
        .get(`/api/files/material/${materialId}/url`)
        .set(authHeader(teacherB.token))
        .expect(200),
    ]);

    expect(openA.body.url).toBe(CANVA_URL);
    expect(openB.body.url).toBe(CANVA_URL);
    expect(openA.body.url).toBe(openB.body.url);
    expect(String(openA.body.url)).not.toMatch(/\/api\/files\/signed\//);

    const checkB = await api(app)
      .get(`/api/materials/access/check/${materialId}`)
      .set(authHeader(teacherB.token))
      .expect(200);
    expect(checkB.body.has_access).toBe(true);
  });

  it('does not apply Canva/external logic to uploaded PDF/Word/Excel/image/video', async () => {
    const teacher = await createTeacherUser(app, adminToken, {
      email: `canva-pdf-${randomUUID()}@test.local`,
      password: 'TeacherPass123!',
      name: 'PDF Teacher',
    });

    const courseRes = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({
        name: `Blob Course ${randomUUID().slice(0, 8)}`,
        courseType: 'basic_beginner',
        totalLessons: 4,
      })
      .expect(201);

    const folderRes = await api(app)
      .post('/api/materials/folders')
      .set(authHeader(adminToken))
      .send({
        name: 'Blob Folder',
        courseTemplateId: courseRes.body.id,
      })
      .expect(201);

    const uploadRes = await api(app)
      .post('/api/files/upload')
      .set(authHeader(teacher.token))
      .attach('file', Buffer.from('%PDF-1.4 canva-regression'), 'notes.pdf')
      .expect(201);

    const materialRes = await api(app)
      .post('/api/materials')
      .set(authHeader(teacher.token))
      .send({
        folderId: folderRes.body.id,
        title: 'Local PDF',
        fileUrl: uploadRes.body.url,
        fileType: 'pdf',
      })
      .expect(201);

    const urlRes = await api(app)
      .get(`/api/files/material/${materialRes.body.id}/url`)
      .set(authHeader(teacher.token))
      .expect(200);

    expect(urlRes.body.url).toMatch(/^\/api\/files\/signed\//);
    expect(urlRes.body.url).not.toBe(uploadRes.body.url);
  });
});
