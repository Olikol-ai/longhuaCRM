import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { ALL_V2_ENTITIES } from './database/entity-registry';
import { GuardsModule } from './common/guards/guards.module';
import { DomainAccessModule } from './common/access/domain-access.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { CoursesModule } from './modules/courses/courses.module';
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
import { StudentsModule } from './modules/students/students.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { UsersModule } from './modules/users/users.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AlfaBankModule } from './modules/alfabank/alfabank.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { FunctionsModule } from './modules/functions/functions.module';
import { SecureFilesModule } from './modules/files/secure-files.module';
import { JobsModule } from './modules/jobs/jobs.module';

const serveFrontend = process.env.SERVE_FRONTEND !== 'false';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '../../../.env'), '.env'],
      load: [configuration],
      validate: validateEnv,
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
        migrationsRun:
          config.get<string>('nodeEnv') === 'production' &&
          process.env.E2E_SYNC_SCHEMA !== 'true',
        logging: config.get<string>('nodeEnv') === 'development',
      }),
    }),
    ScheduleModule.forRoot(),
    GuardsModule,
    DomainAccessModule,
    AuditModule,
    MailModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    TeachersModule,
    CoursesModule,
    GroupsModule,
    LessonsModule,
    LessonSeriesModule,
    ScheduleDomainModule,
    PaymentsModule,
    TeacherPaymentsModule,
    MaterialsModule,
    CertificatesModule,
    NotificationsModule,
    SettingsModule,
    UploadsModule,
    AlfaBankModule,
    TelegramModule,
    WebhooksModule,
    FunctionsModule,
    SecureFilesModule,
    JobsModule,
    HealthModule,
    ...(serveFrontend
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, '../../../dist'),
            exclude: ['/api{*path}'],
          }),
          SpaModule,
        ]
      : []),
  ],
})
export class AppModule {}
