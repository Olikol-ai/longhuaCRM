import { INestApplication } from '@nestjs/common';
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

describeE2E('Secure files upload (e2e)', () => {
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

  it('allows admin to upload a material file', async () => {
    const buffer = Buffer.from('%PDF-1.4 test upload');
    const res = await api(app)
      .post('/api/files/upload')
      .set(authHeader(adminToken))
      .attach('file', buffer, 'lesson-notes.pdf');

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/.+\.pdf$/);
  });

  it('rejects upload without a file', async () => {
    const res = await api(app).post('/api/files/upload').set(authHeader(adminToken));
    expect(res.status).toBe(400);
  });

  it('allows teacher to upload a material file', async () => {
    const teacher = await createTeacherUser(app, adminToken, {
      email: `files-upload-teacher-${Date.now()}@test.local`,
      password: 'TestTeacher123!',
      name: 'Files Upload Teacher',
    });

    const buffer = Buffer.from('%PDF-1.4 teacher upload');
    const res = await api(app)
      .post('/api/files/upload')
      .set(authHeader(teacher.token))
      .attach('file', buffer, 'teacher.pdf');

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/.+\.pdf$/);
  });

  it('rejects disallowed file extensions', async () => {
    const buffer = Buffer.from('malicious');
    const res = await api(app)
      .post('/api/files/upload')
      .set(authHeader(adminToken))
      .attach('file', buffer, 'payload.exe');

    expect(res.status).toBe(400);
  });

  it('supports end-to-end material create with uploaded file', async () => {
    const courseRes = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({ name: `Files Upload Course ${Date.now()}`, courseType: 'basic_beginner' })
      .expect(201);

    const folderRes = await api(app)
      .post('/api/materials/folders')
      .set(authHeader(adminToken))
      .send({ name: 'Upload Folder', courseTemplateId: courseRes.body.id })
      .expect(201);

    const uploadRes = await api(app)
      .post('/api/files/upload')
      .set(authHeader(adminToken))
      .attach('file', Buffer.from('%PDF-1.4 material'), 'worksheet.pdf')
      .expect(201);

    const materialRes = await api(app)
      .post('/api/materials')
      .set(authHeader(adminToken))
      .send({
        folderId: folderRes.body.id,
        title: 'Uploaded Worksheet',
        fileUrl: uploadRes.body.url,
        fileType: 'pdf',
      })
      .expect(201);

    expect(materialRes.body.file_url).toBe(uploadRes.body.url);
    expect(materialRes.body.title).toBe('Uploaded Worksheet');
  });

  it('streams signed material PDF as binary (not serialized StreamableFile JSON)', async () => {
    const courseRes = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({ name: `Signed Stream Course ${Date.now()}`, courseType: 'basic_beginner' })
      .expect(201);

    const folderRes = await api(app)
      .post('/api/materials/folders')
      .set(authHeader(adminToken))
      .send({ name: 'Signed Folder', courseTemplateId: courseRes.body.id })
      .expect(201);

    const pdfBytes = Buffer.from('%PDF-1.4 signed-stream-smoke');
    const uploadRes = await api(app)
      .post('/api/files/upload')
      .set(authHeader(adminToken))
      .attach('file', pdfBytes, 'signed-smoke.pdf')
      .expect(201);

    const materialRes = await api(app)
      .post('/api/materials')
      .set(authHeader(adminToken))
      .send({
        folderId: folderRes.body.id,
        title: 'Signed Smoke PDF',
        fileUrl: uploadRes.body.url,
        fileType: 'pdf',
      })
      .expect(201);

    const urlRes = await api(app)
      .get(`/api/files/material/${materialRes.body.id}/url`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(urlRes.body.url).toMatch(/^\/api\/files\/signed\//);

    const streamRes = await api(app).get(urlRes.body.url).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });

    expect(streamRes.status).toBe(200);
    expect(String(streamRes.headers['content-type'] || '')).toMatch(/application\/pdf/i);
    expect(String(streamRes.headers['content-disposition'] || '')).toMatch(/inline/i);
    expect(String(streamRes.headers['content-disposition'] || '')).toMatch(/filename=/i);

    const body = streamRes.body as Buffer;
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.toString('utf8')).toContain('%PDF-1.4');
    expect(body.toString('utf8')).not.toContain('"options"');
    expect(body.toString('utf8')).not.toContain('"stream"');
  });

  it('rejects invalid signed token', async () => {
    const res = await api(app).get('/api/files/signed/not-a-valid.token');
    expect(res.status).toBe(401);
  });
});
