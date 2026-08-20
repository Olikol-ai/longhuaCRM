/**
 * Abstract video lesson provider.
 * Implementations: Jitsi now; Zoom/Daily/etc. later without changing Lesson consumers.
 */
export type VideoRoomInfo = {
  provider: string;
  roomId: string;
  roomUrl: string;
};

export type VideoAccessData = {
  provider: string;
  roomId: string;
  roomUrl: string;
  displayName: string;
  /** Optional provider JWT / token when the backend is configured for authenticated rooms. */
  token: string | null;
  /** Unix epoch seconds when the Jitsi JWT expires (if issued). */
  tokenExpiresAt?: number | null;
  embedUrl: string;
  /** Hostname for JitsiMeetExternalAPI (e.g. meet.example.com). */
  domain: string;
  /** Room name passed to External API (same as roomId for Jitsi). */
  roomName: string;
  /** Absolute URL to external_api.js on the provider host. */
  externalApiUrl: string;
  /**
   * True only when the configured host cannot admit CRM guests without a personal
   * Jitsi/OAuth account (e.g. public meet.jit.si). Guest-capable hosts return false.
   */
  hostRequiresAccount: boolean;
  /** Conference subject (lesson title) for External API. */
  subject: string | null;
  /** CRM role label passed into the room (преподаватель / ученик / …). */
  roleLabel: string | null;
};

export type VideoLessonContext = {
  id: string;
  title?: string | null;
};

export type VideoAccessInput = {
  roomId: string;
  /** Ignored when provider rebuilds URL from current JITSI_BASE_URL (preferred). */
  roomUrl?: string | null;
  displayName: string;
  userId: string;
  email?: string | null;
  avatarUrl?: string | null;
  roleLabel: string;
  isModerator: boolean;
  subject?: string | null;
};

export interface VideoProvider {
  readonly name: string;

  createRoom(lesson: VideoLessonContext): Promise<VideoRoomInfo> | VideoRoomInfo;

  getRoomUrl(roomId: string): string;

  generateAccessData(
    input: VideoAccessInput,
  ): Promise<VideoAccessData> | VideoAccessData;

  deleteRoom(roomId: string): Promise<void> | void;
}

export const VIDEO_PROVIDER = Symbol('VIDEO_PROVIDER');
