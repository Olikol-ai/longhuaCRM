import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ApiSerializeInterceptor } from '../src/common/interceptors/api-serialize.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { ALL_V2_ENTITIES } from '../src/database/entity-registry';
import { getDatabaseDataSourceOptions, resolvePostgresConnectionConfig } from '../src/database/database.config';
import { PendingRegistrationEntity } from '../src/modules/auth/entities/pending-registration.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { UserEntity } from '../src/modules/users/entities/user.entity';

export type CreateTestAppOptions = {
  mockMailSuccess?: boolean;
};

export type AuthSession = {
  token: string;
  email: string;
};

export async function ensureDatabaseReady(): Promise<void> {
  const connection = resolvePostgresConnectionConfig();
  const adminDs = new DataSource({
    type: 'postgres',
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    database: 'postgres',
  });
  await adminDs.initialize();
  const existing = await adminDs.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
    connection.database,
  ]);
  if (existing.length === 0) {
    await adminDs.query(`CREATE DATABASE "${connection.database}"`);
  }

  await adminDs.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [connection.database],
  );

  await adminDs.destroy();
}

export async function createTestApp(options: CreateTestAppOptions = {}): Promise<INestApplication> {
  const mockMailSuccess = options.mockMailSuccess ?? true;
  let moduleBuilder: TestingModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (mockMailSuccess) {
    moduleBuilder = moduleBuilder.overrideProvider(MailService).useValue({
      isConfigured: () => true,
      onModuleInit: async () => undefined,
      sendVerificationCode: async () => ({ sent: true, status: 'sent' as const }),
      sendTestEmail: async () => ({ success: true }),
    });
  }

  const moduleRef = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ApiSerializeInterceptor());
  await app.init();
  return app;
}

/**
 * Close Nest app and release DB / schedulers / telegram lifecycle handles.
 */
export async function closeTestApp(app: INestApplication | undefined): Promise<void> {
  if (!app) {
    return;
  }

  let dataSource: DataSource | null = null;
  try {
    dataSource = app.get(DataSource, { strict: false });
  } catch {
    dataSource = null;
  }

  await app.close();

  if (dataSource?.isInitialized) {
    await dataSource.destroy();
  }
}

export function api(app: INestApplication) {
  return request(app.getHttpServer());
}

export async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<AuthSession> {
  const res = await api(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  expect(res.body.token).toBeTruthy();
  return { token: res.body.token, email };
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function adminLogin(app: INestApplication): Promise<AuthSession> {
  return login(
    app,
    process.env.ADMIN_EMAIL ?? 'admin@test.local',
    process.env.ADMIN_PASSWORD ?? 'TestAdmin123!',
  );
}

export async function setPendingVerificationCode(
  app: INestApplication,
  email: string,
  code: string,
): Promise<void> {
  const ds = app.get(DataSource);
  const repo = ds.getRepository(PendingRegistrationEntity);
  const pending = await repo.findOne({ where: { email: email.toLowerCase() } });
  if (!pending) {
    throw new Error(`Pending registration not found for ${email}`);
  }
  pending.verificationCodeHash = bcrypt.hashSync(code, 10);
  pending.codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await repo.save(pending);
}

export async function createTeacherUser(
  app: INestApplication,
  adminToken: string,
  params: { email: string; password: string; name: string },
): Promise<{ userId: string; teacherId: string; token: string }> {
  const userId = randomUUID();
  const now = new Date();
  const ds = app.get(DataSource);
  await ds.getRepository(UserEntity).save({
    id: userId,
    email: params.email,
    passwordHash: bcrypt.hashSync(params.password, 10),
    role: 'teacher',
    status: 'active',
    emailVerified: true,
    verificationCode: null,
    verificationCodeExpiresAt: null,
    verificationCodeSentAt: null,
    verificationAttempts: 0,
    firstName: 'Test',
    lastName: 'Teacher',
    phone: '',
    telegramId: '',
    telegramUsername: '',
    telegramConnectedAt: null,
    telegramLinkToken: null,
    telegramLinkExpires: null,
    createdDate: now,
    updatedDate: now,
  });

  const teacherRes = await api(app)
    .post('/api/teachers')
    .set(authHeader(adminToken))
    .send({
      name: params.name,
      email: params.email,
      userId,
      status: 'active',
      hourlyRate: 25,
    })
    .expect(201);

  const session = await login(app, params.email, params.password);
  return {
    userId,
    teacherId: teacherRes.body.id,
    token: session.token,
  };
}

export function futureLessonDate(daysAhead = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dayOfWeekForDate(dateStr: string): number {
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
}
