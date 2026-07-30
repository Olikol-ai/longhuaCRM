import { createHash, randomUUID } from 'crypto';
import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { isAccountRequiredJitsiHost } from './jitsi-guest-token.util';

export type JitsiJwtSignInput = {
  roomName: string;
  userId: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  isModerator: boolean;
  subject?: string | null;
};

export type JitsiJwtResult = {
  token: string;
  jti: string;
  expiresAt: number;
};

/**
 * Single CRM authority for HS256 Jitsi JWTs.
 * Tokens are short-lived; clients refresh via GET /api/video/lessons/:id.
 */
@Injectable()
export class JitsiJwtService {
  /** In-memory one-shot jti set (optional anti-replay for exchange endpoint). */
  private readonly consumedJti = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  credentials(): { appId: string; appSecret: string } {
    const appId = (
      this.config.get<string>('video.jitsiJwtAppId') ||
      process.env.JITSI_JWT_APP_ID ||
      ''
    ).trim();
    const appSecret = (
      this.config.get<string>('video.jitsiJwtAppSecret') ||
      process.env.JITSI_JWT_APP_SECRET ||
      ''
    ).trim();
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException(
        'Видеоурок недоступен: не заданы JITSI_JWT_APP_ID / JITSI_JWT_APP_SECRET. ' +
          'Корпоративный Jitsi принимает только JWT от CRM.',
      );
    }
    return { appId, appSecret };
  }

  ttlSeconds(): number {
    const raw =
      this.config.get<number>('video.jitsiJwtTtlSeconds') ??
      parseInt(process.env.JITSI_JWT_TTL_SECONDS || '900', 10);
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 60) return 900;
    return Math.min(n, 3600);
  }

  assertCorporateHost(domain: string): void {
    if (isAccountRequiredJitsiHost(domain)) {
      throw new ServiceUnavailableException(
        'Публичный Jitsi (meet.jit.si / 8x8.vc) запрещён. ' +
          'Укажите JITSI_BASE_URL на корпоративный self-hosted Jitsi.',
      );
    }
  }

  sign(input: JitsiJwtSignInput): JitsiJwtResult {
    const { appId, appSecret } = this.credentials();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.ttlSeconds();
    const jti = randomUUID();
    const payload = {
      aud: 'jitsi',
      iss: appId,
      sub: appId,
      room: input.roomName,
      nbf: now - 10,
      exp,
      jti,
      context: {
        user: {
          id: input.userId,
          name: input.displayName,
          email: input.email || undefined,
          avatar: input.avatarUrl || undefined,
          moderator: input.isModerator,
          affiliation: input.isModerator ? 'owner' : 'member',
        },
        features: {
          livestreaming: false,
          recording: false,
          transcription: false,
          'outbound-call': false,
        },
        room: input.subject
          ? {
              subject: input.subject,
            }
          : undefined,
      },
    };

    const token = sign(payload, appSecret, { algorithm: 'HS256' });
    return { token, jti, expiresAt: exp };
  }

  /**
   * Optional one-shot consume: first redeem of jti succeeds; repeat → false.
   * Expired entries are pruned lazily.
   */
  consumeJti(jti: string): boolean {
    this.pruneConsumed();
    const key = createHash('sha256').update(String(jti || '')).digest('hex');
    if (!jti || this.consumedJti.has(key)) return false;
    this.consumedJti.set(key, Date.now() + this.ttlSeconds() * 1000);
    return true;
  }

  private pruneConsumed(): void {
    const now = Date.now();
    for (const [key, until] of this.consumedJti) {
      if (until <= now) this.consumedJti.delete(key);
    }
  }
}
