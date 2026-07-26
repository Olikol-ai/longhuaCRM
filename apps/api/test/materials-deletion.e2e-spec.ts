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
import { MaterialLinkEntity } from '../src/modules/materials/entities/material-link.entity';
import { MaterialEntity } from '../src/modules/materials/entities/material.entity';
import { MaterialAccessEntity } from '../src/modules/materials/entities/material-access.entity';
import { MaterialFolderEntity } from '../src/modules/materials/entities/material-folder.entity';
import { CourseTemplateEntity } from '../src/modules/courses/entities/course-template.entity';
import { MaterialCourseGrantEntity } from '../src/modules/materials/entities/material-course-grant.entity';

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

  it('removes unused material from catalog (hard delete or soft if FK history remains)', async () => {
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
    expect(['hard', 'soft']).toContain(deleteRes.body.mode);

    const listRes = await api(app)
      .get('/api/materials')
      .set(authHeader(adminToken))
      .expect(200);

    expect(listRes.body.some((row: { id: string }) => row.id === materialId)).toBe(false);

    const ds = app.get(DataSource);
    const row = await ds.getRepository(MaterialEntity).findOne({ where: { id: materialId } });
    if (deleteRes.body.mode === 'hard') {
      expect(row).toBeNull();
    } else {
      expect(row?.status).toBe('deleted');
    }
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

    await ds.getRepository(MaterialAccessEntity).delete({
      userId: users[0].id,
      materialId,
    });
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

  it('admin soft-deletes course with folders/materials/access; teacher cannot delete', async () => {
    const { courseId, folderId, materialId } = await seedFolderAndMaterial(
      app,
      adminToken,
      `CourseDel ${randomUUID().slice(0, 8)}`,
    );

    const ds = app.get(DataSource);
    const users = await ds.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [
      process.env.ADMIN_EMAIL ?? 'admin@test.local',
    ]);
    expect(users[0]?.id).toBeTruthy();

    const accessRepo = ds.getRepository(MaterialAccessEntity);
    let access = await accessRepo.findOne({
      where: { userId: users[0].id, materialId },
    });
    if (access) {
      access.access = true;
      await accessRepo.save(access);
    } else {
      await accessRepo.save({
        userId: users[0].id,
        materialId,
        access: true,
        grantedByRole: 'ADMIN',
      });
    }

    const grantRepo = ds.getRepository(MaterialCourseGrantEntity);
    const existingGrant = await grantRepo.findOne({
      where: { courseTemplateId: courseId, materialId },
    });
    if (!existingGrant) {
      await grantRepo.save({
        courseTemplateId: courseId,
        materialId,
        grantedByRole: 'ADMIN',
      });
    }
    const teacher = await createTeacherUser(app, adminToken, {
      email: `nodel-t-${randomUUID().slice(0, 8)}@test.local`,
      password: 'TeacherPass123!',
      name: `No Del Teacher ${randomUUID().slice(0, 8)}`,
    });

    await api(app)
      .delete(`/api/courses/${courseId}`)
      .set(authHeader(teacher.token))
      .expect(403);

    const deleted = await api(app)
      .delete(`/api/courses/${courseId}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(deleted.body.is_active ?? deleted.body.isActive).toBe(false);

    const courses = await api(app)
      .get('/api/courses')
      .set(authHeader(adminToken))
      .expect(200);
    expect(courses.body.some((c: { id: string }) => c.id === courseId)).toBe(false);

    const materials = await api(app)
      .get('/api/materials')
      .set(authHeader(adminToken))
      .expect(200);
    expect(materials.body.some((m: { id: string }) => m.id === materialId)).toBe(false);

    const courseRow = await ds
      .getRepository(CourseTemplateEntity)
      .findOne({ where: { id: courseId } });
    expect(courseRow?.isActive).toBe(false);

    const material = await ds.getRepository(MaterialEntity).findOne({ where: { id: materialId } });
    expect(material?.status).toBe('deleted');

    const accessRows = await ds
      .getRepository(MaterialAccessEntity)
      .find({ where: { materialId } });
    expect(accessRows.every((row) => row.access === false)).toBe(true);

    const grants = await ds
      .getRepository(MaterialCourseGrantEntity)
      .find({ where: { courseTemplateId: courseId } });
    expect(grants).toHaveLength(0);

    const folder = await ds.getRepository(MaterialFolderEntity).findOne({ where: { id: folderId } });
    expect(folder).toBeTruthy();
    expect(folder?.courseTemplateId).toBe(courseId);
  });
});
