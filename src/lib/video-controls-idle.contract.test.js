import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

// Hook is ESM JSX-free — load via dynamic import after transform not available.
// Contract: source contains the idle lifecycle guarantees.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('useVideoControlsIdle implements reset/cancel lifecycle', () => {
  const src = readFileSync(join(root, 'hooks/useVideoControlsIdle.js'), 'utf8');
  assert.match(src, /idleMs/);
  assert.match(src, /clearTimeout/);
  assert.match(src, /holdOpen/);
  assert.match(src, /scheduleHide/);
  assert.match(src, /bump/);
  assert.match(src, /return \(\) => \{\s*clearTimer/);
});

test('VideoSessionLayer wires idle controls and hidden participants default', () => {
  const layer = readFileSync(join(root, 'components/video/VideoSessionLayer.jsx'), 'utf8');
  assert.match(layer, /useVideoControlsIdle/);
  assert.match(layer, /controlsVisible/);
  assert.match(layer, /bumpControls/);
  assert.match(layer, /lesson-video-controls-hotzone/);
  assert.match(layer, /participantsOpen.*useState\(false\)/);
  assert.match(layer, /LessonVideoFilmstrip/);
  assert.match(layer, /visible=\{false\}/);
});

test('Jitsi plugin.head styles filmstrip PiP bottom-right', () => {
  const head = readFileSync(join(root, '../jitsi/plugin.head.html'), 'utf8');
  assert.match(head, /longhua-filmstrip-pip/);
  assert.match(head, /justify-content:\s*flex-end/);
  assert.match(head, /11rem/);
});
