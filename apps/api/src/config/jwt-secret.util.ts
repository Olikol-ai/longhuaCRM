import { ConfigService } from '@nestjs/config';

const DEV_JWT_FALLBACK = 'longhua-dev-secret-change-in-production';

/**
 * Single authority for JWT signing/verification secret.
 * Production must never fall back to a dev default.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = String(config.get<string>('jwt.secret') ?? '').trim();
  if (secret) return secret;

  const nodeEnv = String(config.get<string>('nodeEnv') ?? process.env.NODE_ENV ?? 'development');
  if (nodeEnv === 'production') {
    throw new Error('JWT secret is not configured (JWT_SECRET required in production)');
  }

  return DEV_JWT_FALLBACK;
}
