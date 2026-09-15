/**
 * Jitsi Meet web overrides for Longhua 1:1 lessons.
 * Install: scripts/apply-jitsi-custom-config.sh
 *
 * Loaded after config.js on the self-hosted Jitsi web container.
 *
 * Mute policy:
 * - startWith*Muted = join muted once (local).
 * - Do NOT set startAudioMuted/startVideoMuted to 0 — that means “everyone
 *   starts muted” and Jicofo can remute via START_MUTED_FROM_FOCUS after unmute.
 * - ignoreStartMuted blocks that late focus remute.
 *
 * Codecs: VP8-first (AV1-first host defaults caused black remote screen-share).
 */
config.startWithAudioMuted = true;
config.startWithVideoMuted = true;
config.ignoreStartMuted = true;
config.startSilent = false;

// Clear any earlier numeric “everyone muted” policy from base config.js.
config.startAudioMuted = 9999;
config.startVideoMuted = 9999;

config.videoQuality = config.videoQuality || {};
config.videoQuality.codecPreferenceOrder = ['VP8', 'VP9', 'H264', 'AV1'];
config.videoQuality.mobileCodecPreferenceOrder = ['VP8', 'H264', 'VP9', 'AV1'];

config.desktopSharingFrameRate = {
  min: 5,
  max: 15,
};

config.p2p = {
  enabled: true,
  codecPreferenceOrder: ['VP8', 'VP9', 'H264', 'AV1'],
  mobileCodecPreferenceOrder: ['VP8', 'H264', 'VP9', 'AV1'],
  // Explicit STUN — previous overwrite wiped defaults and left 1:1 calls with
  // only host candidates (local preview OK, zero remote RTP behind NAT).
  // TURN/coturn is still required for symmetric NAT / CGNAT; STUN alone is not enough.
  stunServers: [
    // Prefer Longhua origin STUN (coturn). meet.* is CF-proxied — use public IP.
    { urls: 'stun:46.53.182.183:3478' },
    { urls: 'stun:meet-jit-si-turnrelay.jitsi.net:443' },
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

config.openBridgeChannel = 'websocket';

config.filmstrip = config.filmstrip || {};
config.filmstrip.disableStageFilmstrip = false;
config.filmstrip.stageFilmstripParticipants = 1;
