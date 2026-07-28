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
  embedUrl: string;
  /** Hostname for JitsiMeetExternalAPI (e.g. meet.jit.si). */
  domain: string;
  /** Room name passed to External API (same as roomId for Jitsi). */
  roomName: string;
  /** Absolute URL to external_api.js on the provider host. */
  externalApiUrl: string;
  /** True when the public host requires an account to open a room (e.g. meet.jit.si). */
  hostRequiresAccount: boolean;
};

export type VideoLessonContext = {
  id: string;
  title?: string | null;
};

export interface VideoProvider {
  readonly name: string;

  createRoom(lesson: VideoLessonContext): Promise<VideoRoomInfo> | VideoRoomInfo;

  getRoomUrl(roomId: string): string;

  generateAccessData(input: {
    roomId: string;
    roomUrl: string;
    displayName: string;
  }): Promise<VideoAccessData> | VideoAccessData;

  deleteRoom(roomId: string): Promise<void> | void;
}

export const VIDEO_PROVIDER = Symbol('VIDEO_PROVIDER');
