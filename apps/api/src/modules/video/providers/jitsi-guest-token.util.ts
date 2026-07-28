import { sign } from 'jsonwebtoken';

export type JitsiGuestTokenInput = {
  appId: string;
  appSecret: string;
  roomName: string;
  userId: string;
  displayName: string;
  email?: string | null;
  isModerator: boolean;
  /** Lesson subject shown in the conference. */
  subject?: string | null;
  /** Token lifetime in seconds (default 6 hours). */
  expiresInSec?: number;
};

/**
 * HS256 JWT for self-hosted Jitsi (Prosody token auth).
 * CRM users never create a Jitsi account — the CRM signs short-lived guest tokens.
 */
export function createJitsiGuestToken(input: JitsiGuestTokenInput): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (input.expiresInSec ?? 6 * 60 * 60);
  const payload = {
    aud: 'jitsi',
    iss: input.appId,
    sub: input.appId,
    room: input.roomName,
    nbf: now - 10,
    exp,
    context: {
      user: {
        id: input.userId,
        name: input.displayName,
        email: input.email || undefined,
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

  return sign(payload, input.appSecret, { algorithm: 'HS256' });
}

/** Hosts that force personal Jitsi / OAuth accounts (not CRM guests). */
export function isAccountRequiredJitsiHost(domain: string): boolean {
  const host = String(domain || '').toLowerCase();
  return (
    host === 'meet.jit.si' ||
    host.endsWith('.jit.si') ||
    host === '8x8.vc' ||
    host.endsWith('.8x8.vc')
  );
}
