import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VideoAccessData,
  VideoAccessInput,
  VideoLessonContext,
  VideoProvider,
  VideoRoomInfo,
} from './video-provider.interface';
import {
  createJitsiGuestToken,
  isAccountRequiredJitsiHost,
} from './jitsi-guest-token.util';

/**
 * Jitsi Meet provider — allocates room id + URL; clients join as CRM guests.
 *
 * Guest access requirements:
 * - Do NOT use public meet.jit.si (requires personal OAuth accounts).
 * - Point JITSI_BASE_URL at a self-hosted Jitsi with anonymous guests
 *   (ENABLE_AUTH=0) and/or CRM-issued HS256 JWT (JITSI_JWT_APP_ID/SECRET).
 */
@Injectable()
export class JitsiVideoProvider implements VideoProvider {
  readonly name = 'jitsi';

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    const raw =
      this.config.get<string>('video.jitsiBaseUrl') ||
      process.env.JITSI_BASE_URL ||
      '';
    const trimmed = String(raw).trim().replace(/\/$/, '');
    if (!trimmed) {
      throw new ServiceUnavailableException(
        'Видеоурок недоступен: не задан JITSI_BASE_URL. Укажите адрес Jitsi с гостевым доступом (без регистрации).',
      );
    }
    return trimmed;
  }

  private domainFromBase(base: string): string {
    try {
      return new URL(base).hostname;
    } catch {
      throw new ServiceUnavailableException(
        'Видеоурок недоступен: некорректный JITSI_BASE_URL.',
      );
    }
  }

  private sanitizeRoomId(roomId: string): string {
    return String(roomId).trim().replace(/[^a-zA-Z0-9._-]/g, '-');
  }

  private jwtCredentials(): { appId: string; appSecret: string } | null {
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
    if (!appId || !appSecret) return null;
    return { appId, appSecret };
  }

  private assertGuestCapable(domain: string, hasCrmToken: boolean): void {
    if (isAccountRequiredJitsiHost(domain) && !hasCrmToken) {
      throw new ServiceUnavailableException(
        'Публичный Jitsi требует личный аккаунт и не подходит для уроков Longhua. ' +
          'Настройте JITSI_BASE_URL на свой сервер Jitsi с гостевым доступом ' +
          '(см. docker-compose.jitsi.yml) или задайте JITSI_JWT_APP_ID/SECRET для токенов CRM.',
      );
    }
  }

  createRoom(lesson: VideoLessonContext): VideoRoomInfo {
    const base = this.baseUrl();
    const domain = this.domainFromBase(base);
    // Creating a room metadata does not need a token, but we refuse known
    // account-gated public hosts so lessons are not bound to them.
    this.assertGuestCapable(domain, Boolean(this.jwtCredentials()));

    const roomId = `longhua-${lesson.id}`;
    return {
      provider: this.name,
      roomId,
      roomUrl: `${base}/${this.sanitizeRoomId(roomId)}`,
    };
  }

  getRoomUrl(roomId: string): string {
    const id = this.sanitizeRoomId(roomId);
    return `${this.baseUrl()}/${id}`;
  }

  generateAccessData(input: VideoAccessInput): VideoAccessData {
    const displayName = input.displayName.trim() || 'Участник';
    const base = this.baseUrl();
    const domain = this.domainFromBase(base);
    const roomName = this.sanitizeRoomId(input.roomId);
    // Always rebuild from current JITSI_BASE_URL so old meet.jit.si rows migrate.
    const roomUrl = `${base}/${roomName}`;
    const creds = this.jwtCredentials();
    this.assertGuestCapable(domain, Boolean(creds));

    let token: string | null = null;
    if (creds) {
      token = createJitsiGuestToken({
        appId: creds.appId,
        appSecret: creds.appSecret,
        roomName,
        userId: input.userId || `crm-${roomName}`,
        displayName,
        email: input.email,
        isModerator: input.isModerator,
        subject: input.subject,
      });
    }

    const subject = input.subject?.trim() || null;
    const roleLabel = input.roleLabel?.trim() || null;
    const embedParts = [
      `userInfo.displayName="${encodeURIComponent(displayName)}"`,
      'config.prejoinConfig.enabled=false',
      'config.disableDeepLinking=true',
      'config.enableWelcomePage=false',
    ];
    if (subject) {
      embedParts.push(`config.subject="${encodeURIComponent(subject)}"`);
    }

    return {
      provider: this.name,
      roomId: input.roomId,
      roomUrl,
      displayName,
      token,
      embedUrl: `${roomUrl}#${embedParts.join('&')}`,
      domain,
      roomName,
      externalApiUrl: `${base}/external_api.js`,
      // CRM guests never need a personal Jitsi account on a guest-capable host.
      hostRequiresAccount: false,
      subject,
      roleLabel,
    };
  }

  deleteRoom(_roomId: string): void {
    // Rooms are ephemeral; nothing to delete server-side.
  }
}
