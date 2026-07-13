import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';
import { MaterialLinkEntity } from '../src/modules/materials/entities/material-link.entity';
import { MaterialEntity } from '../src/modules/materials/entities/material.entity';
import { MaterialAccessEntity } from '../src/modules/materials/entities/material-access.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

async function seedFolderAndMaterial(
  app: INestApplication,
  adminToken: string,
  title: string,
): Promise<{ folderId: string; materialId: string; courseId: string }> {
  const courseRes = await api(app)
    .post('/api/courses')
    .set(authHeader(adminToken))
    .send({
      name: `Mat Course ${randomUUID().slice(0, 8)}`,
      courseType: 'basic_beginner',
      totalLessons: 10,
    })
    .expect(201);

  const folderRes = await api(app)
    .post('/api/materials/folders')
    .set(authHeader(adminToken))
    .send({
      name: `Folder ${randomUUID().slice(0, 8)}`,
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
      description: 'e2e material',
    })
    .expect(201);

  return {
    folderId: folderRes.body.id,
    materialId: materialRes.body.id,
    courseId: courseRes.body.id,
  };
}

describeE2E('Materials deletion (e2e)', () => {
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

  it('hard-deletes material without links or access', async () => {
    const { materialId } = await seedFolderAndMaterial(
      app,
      adminToken,
      `Unused ${randomUUID().slice(0, 8)}`,
    );

    const deleteRes = await api(app)
      .delete(`/api/materials/${materialId}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.mode).toBe('hard');

    const listRes = await api(app)
      .get('/api/materials')
      .set(authHeader(adminToken))
      .expect(200);

    expect(listRes.body.some((row: { id: string }) => row.id === materialId)).toBe(false);

    const ds = app.get(DataSource);
    const row = await ds.getRepository(MaterialEntity).findOne({ where: { id: materialId } });
    expect(row).toBeNull();
  });

  it('soft-deletes material with lesson link and preserves history', async () => {
    const { materialId } = await seedFolderAndMaterial(
      app,
      adminToken,
      `Linked ${randomUUID().slice(0, 8)}`,
    );

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Mat Teacher ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Mat Student ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacherRes.body.id,
        primaryStudentId: studentRes.body.id,
        date: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        duration: 60,
        status: 'planned',
      })
      .expect(201);

    const ds = app.get(DataSource);
    await ds.getRepository(MaterialLinkEntity).save({
      lessonId: lessonRes.body.id,
      materialId,
    });

    const deleteRes = await api(app)
      .delete(`/api/materials/${materialId}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.mode).toBe('soft');
    expect(deleteRes.body.message).toMatch(/истории|сохранен/i);

    const listRes = await api(app)
      .get('/api/materials')
      .set(authHeader(adminToken))
      .expect(200);
    expect(listRes.body.some((row: { id: string }) => row.id === materialId)).toBe(false);

    const material = await ds.getRepository(MaterialEntity).findOne({ where: { id: materialId } });
    expect(material?.status).toBe('deleted');

    const links = await ds.getRepository(MaterialLinkEntity).find({ where: { materialId } });
    expect(links).toHaveLength(1);
    expect(links[0].lessonId).toBe(lessonRes.body.id);
  });

  it('soft-deletes material with access grant and revokes access', async () => {
    const { materialId } = await seedFolderAndMaterial(
      app,
      adminToken,
      `Access ${randomUUID().slice(0, 8)}`,
    );

    const ds = app.get(DataSource);
    const users = await ds.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [
      process.env.ADMIN_EMAIL ?? 'admin@test.local',
    ]);
    expect(users[0]?.id).toBeTruthy();

    await ds.getRepository(MaterialAccessEntity).save({
      userId: users[0].id,
      materialId,
      access: true,
      grantedByRole: 'ADMIN',
    });

    const deleteRes = await api(app)
      .delete(`/api/materials/${materialId}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(deleteRes.body.mode).toBe('soft');

    const accessRows = await ds
      .getRepository(MaterialAccessEntity)
      .find({ where: { materialId } });
    expect(accessRows.length).toBeGreaterThan(0);
    expect(accessRows.every((row) => row.access === false)).toBe(true);

    const material = await ds.getRepository(MaterialEntity).findOne({ where: { id: materialId } });
    expect(material?.status).toBe('deleted');
  });
});
