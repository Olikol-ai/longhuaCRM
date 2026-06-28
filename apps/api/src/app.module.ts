import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { ALL_ENTITIES } from './entities';
import { AlfaBankModule } from './modules/alfabank/alfabank.module';
import { AuthModule } from './modules/auth/auth.module';
import { EntitiesModule } from './modules/entities/entities.module';
import { FunctionsModule } from './modules/functions/functions.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { LegacyModule } from './modules/legacy/legacy.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SpaModule } from './modules/spa/spa.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { UsersModule } from './modules/users/users.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

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
        entities: ALL_ENTITIES,
        synchronize: false,
        migrations: [join(__dirname, 'database/migrations/*{.ts,.js}')],
        migrationsRun: config.get<string>('nodeEnv') === 'production',
        logging: config.get<string>('nodeEnv') === 'development',
      }),
    }),
    ScheduleModule.forRoot(),
    ...(serveFrontend
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, '../../../dist'),
            exclude: ['/api{*path}'],
          }),
        ]
      : []),
    UsersModule,
    EntitiesModule,
    SettingsModule,
    AuthModule,
    TelegramModule,
    AlfaBankModule,
    JobsModule,
    FunctionsModule,
    WebhooksModule,
    HealthModule,
    LegacyModule,
    ...(serveFrontend ? [SpaModule] : []),
  ],
})
export class AppModule {}
