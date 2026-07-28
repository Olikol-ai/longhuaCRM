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

  createRoom(lesson: VideoLessonContext): VideoRoomInfo {
    const roomId = `longhua-${lesson.id}`;
    return {
      provider: this.name,
      roomId,
      roomUrl: this.getRoomUrl(roomId),
    };
  }

  getRoomUrl(roomId: string): string {
    const safe = encodeURIComponent(String(roomId).trim());
    // Jitsi room names should not be URI-encoded in the path for meet.jit.si
    const id = String(roomId).trim().replace(/[^a-zA-Z0-9._-]/g, '-');
    return `${this.baseUrl()}/${id || safe}`;
  }

  generateAccessData(input: {
    roomId: string;
    roomUrl: string;
    displayName: string;
  }): VideoAccessData {
    const displayName = input.displayName.trim() || 'Участник';
    const embedUrl = `${input.roomUrl}#userInfo.displayName="${encodeURIComponent(displayName)}"`;
    return {
      provider: this.name,
      roomId: input.roomId,
      roomUrl: input.roomUrl,
      displayName,
      token: null,
      embedUrl,
    };
  }

  deleteRoom(_roomId: string): void {
    // Public Jitsi rooms have no server-side delete API.
  }
}
