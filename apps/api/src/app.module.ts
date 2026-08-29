import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { existsSync } from 'fs';
import { join } from 'path';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { ALL_V2_ENTITIES } from './database/entity-registry';
import { GuardsModule } from './common/guards/guards.module';
import { DomainAccessModule } from './common/access/domain-access.module';
import { StorageModule } from './common/storage/storage.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { HomeworkModule } from './modules/homework/homework.module';
import { VideoModule } from './modules/video/video.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { CoursesModule } from './modules/courses/courses.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GroupsModule } from './modules/groups/groups.module';
import { HealthModule } from './modules/health/health.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { MailModule } from './modules/mail/mail.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { LessonSeriesModule } from './modules/lesson-series/lesson-series.module';
import { TeacherPaymentsModule } from './modules/teacher-payments/teacher-payments.module';
import { ScheduleModule as ScheduleDomainModule } from './modules/schedule/schedule.module';
import { SpaModule } from './modules/spa/spa.module';
import { applySpaStaticFileHeaders } from './modules/spa/spa-cache-headers';
import { StudentsModule } from './modules/students/students.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { TeacherStudentContactsModule } from './modules/teacher-student-contacts/teacher-student-contacts.module';
import { TutorsModule } from './modules/tutors/tutors.module';
import { UsersModule } from './modules/users/users.module';
import { AlfaBankModule } from './modules/alfabank/alfabank.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { FunctionsModule } from './modules/functions/functions.module';
import { SecureFilesModule } from './modules/files/secure-files.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ChatsModule } from './modules/chats/chats.module';
import { ExamAcademyModule } from './modules/exam-academy/exam-academy.module';
import { ExamContentModule } from './modules/exam-content/exam-content.module';

const serveFrontend = process.env.SERVE_FRONTEND !== 'false';

function resolveEnvFilePaths(): string[] {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '..', '.env'),
    join(__dirname, '../../../.env'),
    '.env',
  ];
  const unique = [...new Set(candidates)];
  const existing = unique.filter((path) => existsSync(path));
  return existing.length > 0 ? existing : unique.slice(0, 1);
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePaths(),
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get<number>('rateLimit.ttl') ?? 60) * 1000,
            limit: config.get<number>('rateLimit.limit') ?? 120,
          },
        ],
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('databaseUrl'),
        entities: ALL_V2_ENTITIES,
        synchronize:
          config.get<string>('nodeEnv') === 'test' &&
          process.env.E2E_SYNC_SCHEMA === 'true',
        dropSchema:
          config.get<string>('nodeEnv') === 'test' &&
          process.env.E2E_DROP_SCHEMA === 'true',
        migrations: [join(__dirname, 'database/migrations/*{.ts,.js}')],
        migrationsRun: process.env.E2E_SYNC_SCHEMA !== 'true',
        logging: config.get<string>('nodeEnv') === 'development',
        // Prevent unbounded pool waits under load / stuck clients after long uptime.
        maxQueryExecutionTime: 15_000,
        extra: {
          max: 20,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 10_000,
          // Cap individual statements so a blocked query cannot hog pool slots forever.
          options: '-c statement_timeout=30000 -c lock_timeout=15000',
        },
      }),
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    StorageModule,
    GuardsModule,
    DomainAccessModule,
    AuditModule,
    MailModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    TeachersModule,
    TeacherStudentContactsModule,
    TutorsModule,
    CoursesModule,
    DashboardModule,
    GroupsModule,
    LessonsModule,
    LessonSeriesModule,
    ScheduleDomainModule,
    PaymentsModule,
    TeacherPaymentsModule,
    MaterialsModule,
    CertificatesModule,
    AssessmentModule,
    HomeworkModule,
    VideoModule,
    NotificationsModule,
    SettingsModule,
    AlfaBankModule,
    TelegramModule,
    WebhooksModule,
    FunctionsModule,
    SecureFilesModule,
    JobsModule,
    ChatsModule,
    ExamAcademyModule,
    ExamContentModule,
    HealthModule,
    ...(serveFrontend
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, '../../../dist'),
            /**
             * ServeStatic registers GET `{*any}` → index.html for missing files.
             * That must NOT apply to hashed Vite assets: browsers then fail with
             * "text/html is not a valid JavaScript MIME type" after deploys.
             */
            exclude: [
              '/api{*path}',
              '/assets{*path}',
              '/icons{*path}',
              '/uploads{*path}',
              '/socket.io{*path}',
            ],
            serveStaticOptions: {
              /**
               * Hashed `/assets/*` can be cached forever; `index.html` / `sw.js`
               * must never stick in Cloudflare or the browser after a deploy.
               */
              setHeaders: (res, filePath) => {
                applySpaStaticFileHeaders(res, filePath);
              },
            },
          }),
          SpaModule,
        ]
      : []),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
