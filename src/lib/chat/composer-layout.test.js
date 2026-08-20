import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COMPOSER_MODE,
  VOICE_PHASE,
  VOICE_CANCEL_DX,
  VOICE_LOCK_DY,
  VOICE_MIN_SEND_MS,
  clampComposerFieldHeight,
  composerBottomInset,
  formatRecordingClock,
  keyboardInsetPx,
  nextKeyboardBaseline,
  resolveComposerMode,
  resolveKeyboardInset,
  resolveVoiceHoldPhase,
  resolveVoicePointerUp,
  voiceButtonsInteractive,
  voiceFileExtension,
} from './composer-layout.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('mobile composer layout helpers', () => {
  it('resolves idle / typing / recording / preview / picker modes', () => {
    assert.equal(resolveComposerMode({}), COMPOSER_MODE.IDLE);
    assert.equal(resolveComposerMode({ body: '  hi  ' }), COMPOSER_MODE.TYPING);
    assert.equal(resolveComposerMode({ recording: true, body: 'x' }), COMPOSER_MODE.RECORDING);
    assert.equal(
      resolveComposerMode({ preview: { blob: {} }, body: 'x' }),
      COMPOSER_MODE.PREVIEW,
    );
    assert.equal(resolveComposerMode({ tray: 'emoji' }), COMPOSER_MODE.PICKER);
  });

  it('clamps textarea autosize between min and max', () => {
    assert.equal(clampComposerFieldHeight(20), 44);
    assert.equal(clampComposerFieldHeight(80), 80);
    assert.equal(clampComposerFieldHeight(400), 160);
  });

  it('formats recording clock and voice extension', () => {
    assert.equal(formatRecordingClock(0), '0:00');
    assert.equal(formatRecordingClock(14_000), '0:14');
    assert.equal(formatRecordingClock(65_000), '1:05');
    assert.equal(voiceFileExtension('audio/mp4'), 'm4a');
    assert.equal(voiceFileExtension('audio/ogg;codecs=opus'), 'ogg');
    assert.equal(voiceFileExtension('audio/webm'), 'webm');
  });

  it('prefers live keyboard inset to avoid gap above keyboard', () => {
    // Android-like: layout already shrunk with keyboard → live inset only (no baseline gap)
    const android = resolveKeyboardInset({
      baseline: 900,
      innerHeight: 600,
      viewportHeight: 580,
      offsetTop: 0,
    });
    assert.equal(android.inset, 20);
    assert.ok(android.inset < 80);

    // iOS-like: layout stays tall, vv shrinks → live inset
    const iosLive = resolveKeyboardInset({
      baseline: 900,
      innerHeight: 900,
      viewportHeight: 520,
      offsetTop: 0,
    });
    assert.equal(iosLive.inset, 380);

    // Layout + vv both shrunk equally → already accounted for; no extra padding
    const bothShrunk = resolveKeyboardInset({
      baseline: 900,
      innerHeight: 520,
      viewportHeight: 520,
      offsetTop: 0,
    });
    assert.equal(bothShrunk.inset, 0);

    // Tall layout, vv short, live≈0 via offsetTop quirk → baseline fallback
    const quirk = resolveKeyboardInset({
      baseline: 900,
      innerHeight: 900,
      viewportHeight: 520,
      offsetTop: 380,
    });
    assert.equal(quirk.inset, 0);

    assert.equal(keyboardInsetPx(800, 500, 0), 300);
    assert.equal(composerBottomInset({ safeArea: 34, kbdInset: 0 }), 34);
    assert.equal(composerBottomInset({ safeArea: 34, kbdInset: 280 }), 280);
    assert.equal(nextKeyboardBaseline(800, 900, 900, 0), 900);
  });

  it('voice hold phases: left cancel, up lock, release send/keep', () => {
    assert.equal(resolveVoiceHoldPhase({ dx: 0, dy: 0 }), VOICE_PHASE.RECORDING);
    assert.equal(
      resolveVoiceHoldPhase({ dx: -VOICE_CANCEL_DX - 1, dy: 10 }),
      VOICE_PHASE.CANCELLING,
    );
    assert.equal(
      resolveVoiceHoldPhase({ dx: -10, dy: -VOICE_LOCK_DY - 1 }),
      VOICE_PHASE.LOCKED,
    );
    assert.equal(
      resolveVoiceHoldPhase({ dx: -100, dy: -100, locked: true }),
      VOICE_PHASE.LOCKED,
    );
    assert.equal(
      resolveVoicePointerUp({ phase: VOICE_PHASE.CANCELLING }),
      'cancel',
    );
    assert.equal(
      resolveVoicePointerUp({ phase: VOICE_PHASE.RECORDING, durationMs: VOICE_MIN_SEND_MS + 1 }),
      'send',
    );
    assert.equal(
      resolveVoicePointerUp({ phase: VOICE_PHASE.RECORDING, durationMs: 100 }),
      'cancel',
    );
    assert.equal(
      resolveVoicePointerUp({ phase: VOICE_PHASE.LOCKED, locked: true }),
      'keep',
    );
    assert.equal(voiceButtonsInteractive(VOICE_PHASE.LOCKED), true);
    assert.equal(voiceButtonsInteractive(VOICE_PHASE.RECORDING), false);
  });

  it('composer implements hold-to-record on mobile and cancel/send voice', () => {
    const src = readFileSync(join(root, 'components/chats/ChatComposer.jsx'), 'utf8');
    assert.match(src, /holdToRecord|useIsMdUp/);
    assert.match(src, /bindWindowGesture|onWindowPointerUpStable|addEventListener\('pointerup'/);
    assert.match(src, /resolveVoiceHoldPhase|resolveVoicePointerUp/);
    assert.match(src, /VOICE_PHASE|cancelling|locked/);
    assert.match(src, /cancelRecording|Отменить/);
    assert.match(src, /sendRecording|sendOnStopRef/);
    assert.match(src, /stopTracks|streamRef/);
    assert.match(src, /data-voice-buttons/);
    assert.match(src, /chatsApi\.sendMessage/);
    assert.match(src, /onMessageCreated\(message\)/);
    assert.match(src, /data-composer-mode/);
    assert.doesNotMatch(src, /console\.log/);
    assert.doesNotMatch(src, /voicePreview|sendVoicePreview/);
    // Must NOT capture pointer on mic (unmount loses events)
    assert.doesNotMatch(src, /setPointerCapture/);
  });

  it('mobile header has no technical encryption banner', () => {
    const pane = readFileSync(join(root, 'components/chats/ChatMessagePane.jsx'), 'utf8');
    assert.match(pane, /ChatAvatar/);
    assert.doesNotMatch(pane, /сквозным шифрованием|шифротекст|Encryption enabled|E2EE enabled/i);
    assert.match(pane, /Разблокировать/);
  });

  it('chat shell applies keyboard inset on pane without composer safe-area stack', () => {
    const page = readFileSync(join(root, 'pages/Chats.jsx'), 'utf8');
    const css = readFileSync(join(root, 'index.css'), 'utf8');
    assert.match(page, /--lh-kbd-inset/);
    assert.match(page, /lh-chat-pane|data-lh-kbd/);
    assert.match(page, /resolveKeyboardInset/);
    assert.match(css, /lh-chat-composer/);
    assert.match(css, /data-lh-kbd-open/);
    assert.match(css, /html\[data-lh-kbd-open\]\s*\.lh-chat-pane/);
    assert.match(css, /html\[data-lh-kbd-open\]\s*\.lh-chat-composer/);
    assert.match(css, /padding-bottom:\s*0/);
    assert.doesNotMatch(
      css,
      /lh-chat-composer\s*\{[^}]*padding-bottom:[^;]*safe-area-inset-bottom[^;]*--lh-kbd-inset/,
    );
  });

  it('composer bottom inset policy avoids double padding', () => {
    assert.equal(composerBottomInset({ safeArea: 34, kbdInset: 12 }), 34);
    assert.equal(composerBottomInset({ safeArea: 34, kbdInset: 41 }), 41);
  });
});
