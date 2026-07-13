import compression from 'compression';
import helmet from 'helmet';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function configureHttpMiddleware(app: INestApplication, config: ConfigService): void {
  const nodeEnv = config.get<string>('nodeEnv') ?? 'development';
  const trustProxy = config.get<boolean>('trustProxy') ?? false;

  if (trustProxy) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
  }

  if (nodeEnv === 'production') {
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );
    app.use(compression());
  }
}

export function configureCors(app: INestApplication, config: ConfigService): void {
  const nodeEnv = config.get<string>('nodeEnv') ?? 'development';
  const configuredOrigins = config.get<string[]>('cors.origins') ?? [];
  const publicUrl = config.get<string>('appPublicUrl');

  if (configuredOrigins.length > 0) {
    app.enableCors({ origin: configuredOrigins, credentials: true });
    return;
  }

  if (nodeEnv === 'production') {
    const origins = publicUrl ? [publicUrl] : [];
    if (origins.length === 0) {
      Logger.warn(
        'CORS: set CORS_ORIGINS or APP_PUBLIC_URL in production. Browser API calls may fail.',
        'Bootstrap',
      );
    }
    app.enableCors({ origin: origins.length > 0 ? origins : false, credentials: true });
    return;
  }

  app.enableCors({ origin: true, credentials: true });
}

export function registerGracefulShutdown(app: INestApplication): void {
  app.enableShutdownHooks();

  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  for (const signal of signals) {
    process.on(signal, () => {
      Logger.log(`Received ${signal}, shutting down gracefully…`, 'Bootstrap');
      void app.close().finally(() => process.exit(0));
    });
  }
}
