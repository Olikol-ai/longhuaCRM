import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
  app.useWebSocketAdapter(new IoAdapter(app));

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

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Longhua Academy API')
      .setDescription('API documentation including Assessment')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);

  // Large material uploads (chunked or single) can run for a long time on slow links.
  // Keep the rest of the API responsive; only lift HTTP server idle/request ceilings.
  const httpServer = app.getHttpServer() as import('http').Server & {
    requestTimeout?: number;
  };
  const uploadIdleMs = 4 * 60 * 60 * 1000;
  httpServer.setTimeout(uploadIdleMs);
  httpServer.headersTimeout = uploadIdleMs + 60_000;
  httpServer.keepAliveTimeout = 120_000;
  if (typeof httpServer.requestTimeout === 'number') {
    httpServer.requestTimeout = uploadIdleMs;
  }

  Logger.log(
    `Longhua Academy API (${nodeEnv}) on http://localhost:${port} [log=${logLevel}]`,
    'Bootstrap',
  );
}

bootstrap();
