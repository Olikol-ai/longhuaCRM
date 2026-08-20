import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from './jwt-secret.util';

function mockConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('resolveJwtSecret', () => {
  it('returns configured secret when present', () => {
    const secret = resolveJwtSecret(
      mockConfig({ 'jwt.secret': '  my-production-secret-value-32chars  ', nodeEnv: 'production' }),
    );
    expect(secret).toBe('my-production-secret-value-32chars');
  });

  it('throws in production when secret missing', () => {
    expect(() =>
      resolveJwtSecret(mockConfig({ 'jwt.secret': '', nodeEnv: 'production' })),
    ).toThrow(/JWT secret is not configured/);
  });

  it('uses dev fallback only outside production', () => {
    const secret = resolveJwtSecret(mockConfig({ 'jwt.secret': '', nodeEnv: 'development' }));
    expect(secret).toContain('dev-secret');
  });
});
