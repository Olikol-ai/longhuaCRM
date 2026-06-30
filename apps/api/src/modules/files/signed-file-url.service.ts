import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface SignedFilePayload {
  materialId: string;
  userId: string;
  role: string;
  exp: number;
}

@Injectable()
export class SignedFileUrlService {
  private readonly ttlSeconds: number;

  constructor(private readonly config: ConfigService) {
    this.ttlSeconds = Number(this.config.get<string>('files.signedUrlTtlSeconds') ?? 900);
  }

  generateSignedUrl(userId: string, materialId: string, role: string): string {
    const exp = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const payload: SignedFilePayload = { materialId, userId, role, exp };
    const token = this.sign(payload);
    return `/api/files/signed/${token}`;
  }

  validateSignedUrl(token: string): SignedFilePayload {
    const payload = this.verify(token);
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Signed file URL expired');
    }
    return payload;
  }

  private sign(payload: SignedFilePayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = this.hmac(body);
    return `${body}.${sig}`;
  }

  private verify(token: string): SignedFilePayload {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid signed file URL');
    }
    const [body, sig] = parts;
    const expected = this.hmac(body);
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      throw new UnauthorizedException('Invalid signed file URL');
    }
    try {
      const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SignedFilePayload;
      if (!parsed.materialId || !parsed.userId || !parsed.role || !parsed.exp) {
        throw new Error('invalid payload');
      }
      return parsed;
    } catch {
      throw new UnauthorizedException('Invalid signed file URL');
    }
  }

  private hmac(body: string): string {
    const secret =
      this.config.get<string>('jwt.secret') ?? 'longhua-dev-secret-change-in-production';
    return createHmac('sha256', secret).update(body).digest('base64url');
  }
}
