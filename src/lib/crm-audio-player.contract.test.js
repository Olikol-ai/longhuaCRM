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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Unified CRM audio player', () => {
  it('AuthenticatedAudio is the single styled HTML5 player with seek and exclusive play', () => {
    const player = read('components/media/AuthenticatedAudio.jsx');
    assert.match(player, /crm-audio-player/);
    assert.match(player, /data-testid="crm-audio-player"/);
    assert.match(player, /<audio/);
    assert.match(player, /controls/);
    assert.match(player, /withAccessToken/);
    assert.match(player, /claimLearningAudio/);
    assert.match(player, /disposeLearningAudioElement/);
    assert.match(
      player,
      /Не удалось загрузить аудиозапись\. Попробуйте обновить страницу или повторить попытку позже\./,
    );
    assert.match(player, /Повторить/);
    assert.doesNotMatch(player, /maxPlays|disableSeek|listenLimit/);
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

describe('learning-audio-runtime', () => {
  it('pauses the previous element when another claims playback', () => {
    const first = {
      paused: false,
      pause() {
        this.paused = true;
      },
      classList: { contains: () => true },
    };
    const second = {
      paused: false,
      pause() {
        this.paused = true;
      },
      classList: { contains: () => true },
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
