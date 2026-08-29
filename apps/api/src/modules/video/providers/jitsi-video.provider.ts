import { randomUUID } from 'crypto';
import {
  Injectable,
  Logger,
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
import { JitsiJwtService } from './jitsi-jwt.service';

/**
 * Corporate Jitsi provider — UUID rooms + mandatory CRM JWT.
 * Telegram/share links stay on CRM `/lesson/:id/video` (never raw room URL).
 */
@Injectable()
export class JitsiVideoProvider implements VideoProvider {
  readonly name = 'jitsi';
  private readonly logger = new Logger(JitsiVideoProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jitsiJwt: JitsiJwtService,
  ) {}

  private baseUrl(): string {
    const raw =
      this.config.get<string>('video.jitsiBaseUrl') ||
      process.env.JITSI_BASE_URL ||
      '';
    const trimmed = String(raw).trim().replace(/\/$/, '');
    if (!trimmed) {
      throw new ServiceUnavailableException(
        'Видеоурок недоступен: не задан JITSI_BASE_URL. Укажите адрес корпоративного Jitsi.',
      );
    }
    return trimmed;
  }

  private domainFromBase(base: string): string {
    try {
      const parsed = new URL(base);
      // JitsiMeetExternalAPI loads https://{domain}/{room} — a path prefix
      // (e.g. /meet) is silently dropped and the iframe hits the CRM SPA.
      const path = (parsed.pathname || '/').replace(/\/$/, '') || '/';
      if (path !== '/') {
        throw new ServiceUnavailableException(
          'JITSI_BASE_URL должен быть корневым хостом без path-prefix ' +
            '(например https://meet.example.com). Path вроде /meet ломает iframe External API.',
        );
      }
      if (!parsed.hostname) {
        throw new ServiceUnavailableException(
          'Видеоурок недоступен: некорректный JITSI_BASE_URL.',
        );
      }
      return parsed.hostname;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException(
        'Видеоурок недоступен: некорректный JITSI_BASE_URL.',
      );
    }
  }

  private sanitizeRoomId(roomId: string): string {
    return String(roomId).trim().replace(/[^a-zA-Z0-9._-]/g, '-');
  }

  createRoom(_lesson: VideoLessonContext): VideoRoomInfo {
    const base = this.baseUrl();
    const domain = this.domainFromBase(base);
    this.jitsiJwt.assertCorporateHost(domain);
    // Ensure JWT secrets exist before binding a lesson to this host.
    this.jitsiJwt.credentials();

    const roomId = randomUUID();
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
    this.jitsiJwt.assertCorporateHost(domain);

    const roomName = this.sanitizeRoomId(input.roomId);
    const roomUrl = `${base}/${roomName}`;
    const { token, expiresAt } = this.jitsiJwt.sign({
      roomName,
      userId: input.userId || `crm-${roomName}`,
      displayName,
      email: input.email,
      avatarUrl: input.avatarUrl,
      isModerator: input.isModerator,
      subject: input.subject,
      role: input.roleLabel,
    });
    // Diagnostic only — never log the JWT itself.
    this.logger.log(
      `jwt_issued room=${roomName} userId=${input.userId || 'n/a'} moderator=${Boolean(input.isModerator)} exp=${expiresAt}`,
    );

    const subject = input.subject?.trim() || null;
    const roleLabel = input.roleLabel?.trim() || null;
    const embedParts = [
      `userInfo.displayName="${encodeURIComponent(displayName)}"`,
      'config.prejoinConfig.enabled=false',
      'config.disableDeepLinking=true',
      'config.enableWelcomePage=false',
      'config.toolbarButtons=[]',
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
      tokenExpiresAt: expiresAt,
      embedUrl: `${roomUrl}#${embedParts.join('&')}`,
      domain,
      roomName,
      externalApiUrl: `${base}/external_api.js`,
      hostRequiresAccount: false,
      subject,
      roleLabel,
    };
  }

  deleteRoom(_roomId: string): void {
    // Rooms are ephemeral; nothing to delete server-side.
  }
}
