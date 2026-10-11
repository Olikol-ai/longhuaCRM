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

/**
 * Teacher with an explicit personal grant must open/download audio materials
 * via signed URLs (including HTTP Range for HTML5 <audio>).
 */
describeE2E('Teacher audio material open/download (e2e)', () => {
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

  async function seedAudioMaterial(title: string): Promise<{
    materialId: string;
    audioBytes: Buffer;
  }> {
    const courseRes = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({
        name: `Audio Course ${randomUUID().slice(0, 8)}`,
        courseType: 'basic_beginner',
      })
      .expect(201);

    const folderRes = await api(app)
      .post('/api/materials/folders')
      .set(authHeader(adminToken))
      .send({
        name: `Audio Folder ${randomUUID().slice(0, 8)}`,
        courseTemplateId: courseRes.body.id,
      })
      .expect(201);

    // Minimal fake MP3-ish payload (binary; not a real frame — enough for stream/ACL tests).
    const audioBytes = Buffer.from(
      `ID3fake-audio-${title}-${'0123456789'.repeat(20)}`,
      'utf8',
    );

    const uploadRes = await api(app)
      .post('/api/files/upload')
      .set(authHeader(adminToken))
      .attach('file', audioBytes, {
        filename: 'урок-аудио.mp3',
        contentType: 'audio/mpeg',
      })
      .expect(201);

    const materialRes = await api(app)
      .post('/api/materials')
      .set(authHeader(adminToken))
      .send({
        folderId: folderRes.body.id,
        title,
        fileUrl: uploadRes.body.url,
        fileType: 'audio',
        mimeType: uploadRes.body.mime_type || 'audio/mpeg',
        originalFilename: uploadRes.body.original_name || 'урок-аудио.mp3',
        fileSizeBytes: uploadRes.body.size_bytes,
      })
      .expect(201);

    return { materialId: materialRes.body.id, audioBytes };
  }

  it('teacher with personal grant gets signed audio URL, full body, and Range 206', async () => {
    const title = `Teacher Audio ${randomUUID().slice(0, 8)}`;
    const { materialId, audioBytes } = await seedAudioMaterial(title);

    const teacher = await createTeacherUser(app, adminToken, {
      email: `audio-teacher-${randomUUID().slice(0, 8)}@test.local`,
      password: 'TestTeacher123!',
      name: 'Audio Access Teacher',
    });
    const outsider = await createTeacherUser(app, adminToken, {
      email: `audio-outsider-${randomUUID().slice(0, 8)}@test.local`,
      password: 'TestTeacher123!',
      name: 'Audio Outsider Teacher',
    });

    // Before grant: no material in list, /url returns null (not an open storage leak).
    const beforeList = await api(app)
      .get('/api/materials')
      .set(authHeader(teacher.token))
      .expect(200);
    expect(beforeList.body.some((row: { id: string }) => row.id === materialId)).toBe(
      false,
    );

    const beforeUrl = await api(app)
      .get(`/api/files/material/${materialId}/url`)
      .set(authHeader(teacher.token))
      .expect(200);
    expect(beforeUrl.body.url).toBeNull();

    await api(app)
      .post('/api/materials/access/grant')
      .set(authHeader(adminToken))
      .send({
        materialIds: [materialId],
        targetType: 'user',
        targetId: teacher.userId,
        grantedByRole: 'ADMIN',
      })
      .expect(201);

    const afterList = await api(app)
      .get('/api/materials')
      .set(authHeader(teacher.token))
      .expect(200);
    expect(afterList.body.some((row: { id: string }) => row.id === materialId)).toBe(true);

    const urlRes = await api(app)
      .get(`/api/files/material/${materialId}/url`)
      .set(authHeader(teacher.token))
      .expect(200);
    expect(urlRes.body.url).toMatch(/^\/api\/files\/signed\//);

    const full = await api(app)
      .get(urlRes.body.url)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(full.status).toBe(200);
    expect(String(full.headers['accept-ranges'] || '')).toMatch(/bytes/i);
    expect(String(full.headers['content-type'] || '')).toMatch(/audio\//i);
    expect(String(full.headers['content-disposition'] || '')).toMatch(/inline/i);
    expect(Buffer.isBuffer(full.body)).toBe(true);
    expect((full.body as Buffer).equals(audioBytes)).toBe(true);

    const partial = await api(app)
      .get(urlRes.body.url)
      .set('Range', 'bytes=0-7')
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(partial.status).toBe(206);
    expect(String(partial.headers['content-range'] || '')).toMatch(
      new RegExp(`bytes 0-7/${audioBytes.length}`),
    );
    expect((partial.body as Buffer).equals(audioBytes.subarray(0, 8))).toBe(true);

    // Teacher without grant must not receive a signed URL.
    const deniedUrl = await api(app)
      .get(`/api/files/material/${materialId}/url`)
      .set(authHeader(outsider.token))
      .expect(200);
    expect(deniedUrl.body.url).toBeNull();

    // Unauthenticated caller cannot use a forged/invalid token.
    const unauth = await api(app).get('/api/files/signed/not-a-valid.token');
    expect(unauth.status).toBe(401);
  });

  it('admin and material creator keep open access; unsigned token stays closed', async () => {
    const title = `Creator Audio ${randomUUID().slice(0, 8)}`;
    const teacher = await createTeacherUser(app, adminToken, {
      email: `audio-creator-${randomUUID().slice(0, 8)}@test.local`,
      password: 'TestTeacher123!',
      name: 'Audio Creator Teacher',
    });

    const courseRes = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({
        name: `Creator Course ${randomUUID().slice(0, 8)}`,
        courseType: 'basic_beginner',
      })
      .expect(201);

    const folderRes = await api(app)
      .post('/api/materials/folders')
      .set(authHeader(adminToken))
      .send({
        name: `Creator Folder ${randomUUID().slice(0, 8)}`,
        courseTemplateId: courseRes.body.id,
      })
      .expect(201);

    const audioBytes = Buffer.from(`creator-audio-${'abcdefghij'.repeat(8)}`);
    const uploadRes = await api(app)
      .post('/api/files/upload')
      .set(authHeader(teacher.token))
      .attach('file', audioBytes, {
        filename: 'mine.mp3',
        contentType: 'audio/mpeg',
      })
      .expect(201);

    const materialRes = await api(app)
      .post('/api/materials')
      .set(authHeader(teacher.token))
      .send({
        folderId: folderRes.body.id,
        title,
        fileUrl: uploadRes.body.url,
        fileType: 'audio',
        mimeType: 'audio/mpeg',
        originalFilename: 'mine.mp3',
      })
      .expect(201);

    const creatorUrl = await api(app)
      .get(`/api/files/material/${materialRes.body.id}/url`)
      .set(authHeader(teacher.token))
      .expect(200);
    expect(creatorUrl.body.url).toMatch(/^\/api\/files\/signed\//);

    const adminUrl = await api(app)
      .get(`/api/files/material/${materialRes.body.id}/url`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(adminUrl.body.url).toMatch(/^\/api\/files\/signed\//);

    const stream = await api(app)
      .get(adminUrl.body.url)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(stream.status).toBe(200);
    expect((stream.body as Buffer).equals(audioBytes)).toBe(true);
  });
});
