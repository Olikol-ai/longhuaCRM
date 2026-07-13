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

  it('returns workspace payload for created group', async () => {
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

    const workspace = await api(app)
      .get(`/api/groups/${group.body.id}/workspace`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(workspace.body.group?.id ?? workspace.body.group?.id).toBe(group.body.id);
    expect(Array.isArray(workspace.body.members)).toBe(true);
    expect(Array.isArray(workspace.body.lessons)).toBe(true);
    expect(Array.isArray(workspace.body.series)).toBe(true);
  });
});
