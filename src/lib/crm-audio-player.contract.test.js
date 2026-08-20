import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  claimLearningAudio,
  disposeLearningAudioElement,
  releaseLearningAudio,
  stopAllLearningAudio,
} from './learning-audio-runtime.js';
import {
  barsFromId,
  commitSeekToMedia,
  formatAudioClock,
  isFiniteDuration,
  playbackPosition,
  seekRatioFromClientX,
} from './audio/audioPlayerUtils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('LonghuaAudioPlayer unification', () => {
  it('LonghuaAudioPlayer is the single custom engine (no native controls UI)', () => {
    const player = read('components/media/LonghuaAudioPlayer.jsx');
    const hook = read('hooks/useAudioPlayer.js');
    assert.match(player, /useAudioPlayer/);
    assert.match(player, /lh-audio-engine/);
    assert.match(player, /data-testid="crm-audio-player"/);
    assert.match(hook, /setPointerCapture/);
    assert.match(hook, /onTrackPointerDown/);
    assert.match(hook, /claimLearningAudio/);
    assert.match(hook, /commitSeekToMedia/);
    assert.match(hook, /pendingSeekRef/);
    assert.match(player, /PLAYBACK_SPEEDS/);
    assert.doesNotMatch(hook, /disposeLearningAudioElement/);
    assert.doesNotMatch(player, /\bcontrols=/);
    assert.doesNotMatch(player, /controlsList/);
    assert.doesNotMatch(player, /<audio[^>]*\scontrols\b/);
  });

  it('AuthenticatedAudio delegates to LonghuaAudioPlayer with withAccessToken', () => {
    const player = read('components/media/AuthenticatedAudio.jsx');
    assert.match(player, /LonghuaAudioPlayer/);
    assert.match(player, /withAccessToken/);
    assert.doesNotMatch(player, /<audio/);
    assert.doesNotMatch(player, /\bcontrols=/);
  });

  it('VoicePlayer delegates to LonghuaAudioPlayer variant=voice', () => {
    const voice = read('components/chats/VoicePlayer.jsx');
    assert.match(voice, /LonghuaAudioPlayer/);
    assert.match(voice, /variant="voice"/);
    assert.doesNotMatch(voice, /<audio/);
    assert.doesNotMatch(voice, /seekFromClientX/);
  });

  it('learning surfaces reuse AuthenticatedAudio (no alternate <audio controls>)', () => {
    const files = [
      'components/assessment/ListeningAudioPanel.jsx',
      'components/assessment/QuestionCard.jsx',
      'components/assessment/SpeakingAnswerPanel.jsx',
      'components/assessment/ListeningTaskEditor.jsx',
      'components/assessment/QuestionFormDialog.jsx',
      'components/assessment/QuestionPreviewDialog.jsx',
      'components/hsk-academy/items/MediaStem.jsx',
      'pages/TeacherAssessmentReviewDetail.jsx',
      'pages/HomeworkResults.jsx',
      'pages/hsk-academy/HskAcademyTake.jsx',
      'pages/StudentExamTake.jsx',
      'components/assessment/LearnerQuestionBlocks.jsx',
    ];
    for (const rel of files) {
      const src = read(rel);
      assert.match(
        src,
        /AuthenticatedAudio|ListeningAudioPanel|stopAllLearningAudio/,
        rel,
      );
      assert.doesNotMatch(src, /<audio\s+controls/, `${rel} must not use raw audio controls`);
    }
  });

  it('ListeningAudioPanel delegates playback to AuthenticatedAudio', () => {
    const panel = read('components/assessment/ListeningAudioPanel.jsx');
    assert.match(panel, /AuthenticatedAudio/);
    assert.match(panel, /listening-audio-panel/);
    assert.doesNotMatch(panel, /<audio/);
  });

  it('exam and HSK navigation stop audio when leaving a listening block', () => {
    const exam = read('pages/StudentExamTake.jsx');
    const hsk = read('pages/hsk-academy/HskAcademyTake.jsx');
    assert.match(exam, /stopAllLearningAudio/);
    assert.match(exam, /sameListeningBlock/);
    assert.match(hsk, /stopAllLearningAudio/);
    assert.match(hsk, /sameListeningBlock/);
  });
});

describe('audioPlayerUtils', () => {
  it('formats clock and rejects non-finite duration', () => {
    assert.equal(formatAudioClock(65), '1:05');
    assert.equal(formatAudioClock(NaN), '0:00');
    assert.equal(isFiniteDuration(NaN), false);
    assert.equal(isFiniteDuration(Infinity), false);
    assert.equal(isFiniteDuration(12.5), true);
  });

  it('seekRatioFromClientX clamps to 0..1', () => {
    const track = {
      getBoundingClientRect: () => ({ left: 100, width: 200 }),
    };
    assert.equal(seekRatioFromClientX(track, 100), 0);
    assert.equal(seekRatioFromClientX(track, 200), 0.5);
    assert.equal(seekRatioFromClientX(track, 300), 1);
    assert.equal(seekRatioFromClientX(track, 50), 0);
    assert.equal(seekRatioFromClientX(track, 400), 1);
  });

  it('barsFromId is deterministic', () => {
    assert.deepEqual(barsFromId('a', 4), barsFromId('a', 4));
    assert.notDeepEqual(barsFromId('a', 4), barsFromId('b', 4));
  });

  it('seek to 120s of a 300s track commits currentTime ≈ 120', () => {
    const media = { duration: 300, readyState: 1, currentTime: 0 };
    const result = commitSeekToMedia(media, 120);
    assert.equal(result.applied, true);
    assert.equal(media.currentTime, 120);
    assert.equal(playbackPosition(media), 120);
  });

  it('seek backward 180 → 120 does not reset to 0', () => {
    const media = { duration: 300, readyState: 1, currentTime: 180 };
    commitSeekToMedia(media, 120);
    assert.equal(media.currentTime, 120);
    assert.notEqual(media.currentTime, 0);
  });

  it('queues seek until metadata is ready, then play keeps that position', () => {
    const media = { duration: NaN, readyState: 0, currentTime: 0 };
    const pending = commitSeekToMedia(media, 120);
    assert.equal(pending.applied, false);
    assert.equal(pending.pending, 120);
    assert.equal(media.currentTime, 0);
    media.duration = 300;
    media.readyState = 1;
    const committed = commitSeekToMedia(media, pending.pending);
    assert.equal(committed.applied, true);
    assert.equal(media.currentTime, 120);
    media.paused = false;
    assert.equal(playbackPosition(media), 120);
  });
});

describe('learning-audio-runtime', () => {
  it('pauses the previous element when another claims playback', () => {
    const first = {
      paused: false,
      pause() {
        this.paused = true;
      },
      classList: { contains: (name) => name === 'lh-audio-engine' },
    };
    const second = {
      paused: false,
      pause() {
        this.paused = true;
      },
      classList: { contains: (name) => name === 'lh-audio-engine' },
    };
    claimLearningAudio(first);
    claimLearningAudio(second);
    assert.equal(first.paused, true);
    releaseLearningAudio(second);
    stopAllLearningAudio();
  });

  it('dispose clears src and pauses', () => {
    const el = {
      paused: false,
      pause() {
        this.paused = true;
      },
      removeAttribute(name) {
        this[name] = null;
      },
      load() {
        this.loaded = true;
      },
    };
    disposeLearningAudioElement(el);
    assert.equal(el.paused, true);
    assert.equal(el.src, null);
    assert.equal(el.loaded, true);
  });
});
