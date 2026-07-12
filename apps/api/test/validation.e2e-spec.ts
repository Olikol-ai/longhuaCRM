import { INestApplication } from '@nestjs/common';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('Create DTO validation (e2e)', () => {
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

  it('rejects empty student name', async () => {
    const res = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('rejects empty teacher name', async () => {
    const res = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('rejects empty group name', async () => {
    const teacher = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: 'Validation Teacher' });
    const res = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({ name: '', teacherId: teacher.body.id });
    expect(res.status).toBe(400);
  });

  it('rejects empty course name', async () => {
    const res = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({ name: '', courseType: 'basic_beginner' });
    expect(res.status).toBe(400);
  });

  it('rejects empty certificate registration number', async () => {
    const res = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: '00000000-0000-4000-8000-000000000001',
        courseId: '00000000-0000-4000-8000-000000000002',
        registrationNumber: '',
      });
    expect(res.status).toBe(400);
  });

  it('rejects zero payment amount', async () => {
    const res = await api(app)
      .post('/api/payments')
      .set(authHeader(adminToken))
      .send({
        studentId: '00000000-0000-4000-8000-000000000001',
        amount: 0,
      });
    expect(res.status).toBe(400);
  });
});
