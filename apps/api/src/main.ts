import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  configureCors,
  configureHttpMiddleware,
  registerGracefulShutdown,
} from './bootstrap/http-bootstrap';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ApiSerializeInterceptor } from './common/interceptors/api-serialize.interceptor';

async function bootstrap() {
  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    Logger.error(`Unhandled promise rejection: ${message}`, 'Bootstrap');
  });
  process.on('uncaughtException', (error) => {
    Logger.error(`Uncaught exception: ${error.message}`, error.stack, 'Bootstrap');
  });

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    rawBody: false,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3001;
  const nodeEnv = config.get<string>('nodeEnv') ?? 'development';
  const logLevel = config.get<string>('logLevel') ?? 'log';

  app.setGlobalPrefix('api');
  configureHttpMiddleware(app, config);
  configureCors(app, config);
  registerGracefulShutdown(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ApiSerializeInterceptor());

  await app.listen(port);
  Logger.log(
    `Longhua CRM API (${nodeEnv}) on http://localhost:${port} [log=${logLevel}]`,
    'Bootstrap',
  );
}

bootstrap();
