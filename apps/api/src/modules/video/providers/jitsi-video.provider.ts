import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VideoAccessData,
  VideoLessonContext,
  VideoProvider,
  VideoRoomInfo,
} from './video-provider.interface';

/**
 * Jitsi Meet provider — rooms are created on first join; we only allocate id + URL.
 * Base URL via JITSI_BASE_URL (default https://meet.jit.si).
 *
 * Prefer embedding via JitsiMeetExternalAPI on the client (not a raw iframe src),
 * so media permissions and auth retry run on a user gesture.
 */
@Injectable()
export class JitsiVideoProvider implements VideoProvider {
  readonly name = 'jitsi';

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    const raw =
      this.config.get<string>('video.jitsiBaseUrl') ||
      process.env.JITSI_BASE_URL ||
      'https://meet.jit.si';
    return raw.replace(/\/$/, '');
  }

  private domain(): string {
    try {
      return new URL(this.baseUrl()).hostname;
    } catch {
      return 'meet.jit.si';
    }
  }

  private sanitizeRoomId(roomId: string): string {
    return String(roomId).trim().replace(/[^a-zA-Z0-9._-]/g, '-');
  }

  /**
   * Public meet.jit.si requires an account to create/open rooms; auth uses a popup
   * that browsers block unless started from a user gesture (External API retry).
   * Self-hosted instances typically allow anonymous guests.
   */
  private hostRequiresAccount(domain: string): boolean {
    return domain === 'meet.jit.si' || domain.endsWith('.jit.si');
  }

  createRoom(lesson: VideoLessonContext): VideoRoomInfo {
    const roomId = `longhua-${lesson.id}`;
    return {
      provider: this.name,
      roomId,
      roomUrl: this.getRoomUrl(roomId),
    };
  }

  getRoomUrl(roomId: string): string {
    const id = this.sanitizeRoomId(roomId);
    return `${this.baseUrl()}/${id}`;
  }

  generateAccessData(input: {
    roomId: string;
    roomUrl: string;
    displayName: string;
  }): VideoAccessData {
    const displayName = input.displayName.trim() || 'Участник';
    const domain = this.domain();
    const roomName = this.sanitizeRoomId(input.roomId);
    const roomUrl = input.roomUrl || this.getRoomUrl(roomName);
    // Hash config is a fallback only; client should use External API + userInfo.
    const embedUrl = `${roomUrl}#userInfo.displayName="${encodeURIComponent(displayName)}"&config.prejoinConfig.enabled=false&config.disableDeepLinking=true`;

    return {
      provider: this.name,
      roomId: input.roomId,
      roomUrl,
      displayName,
      token: null,
      embedUrl,
      domain,
      roomName,
      externalApiUrl: `https://${domain}/external_api.js`,
      hostRequiresAccount: this.hostRequiresAccount(domain),
    };
  }

  deleteRoom(_roomId: string): void {
    // Public Jitsi rooms have no server-side delete API.
  }
}
