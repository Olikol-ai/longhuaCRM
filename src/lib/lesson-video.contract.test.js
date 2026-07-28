import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canStartVideoLesson,
  isOnlineLesson,
  lessonVideoPath,
} from './lesson-video.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('lesson-video helpers', () => {
  it('builds CRM video path', () => {
    assert.equal(lessonVideoPath('abc'), '/lesson/abc/video');
  });

  it('detects online lessons', () => {
    assert.equal(isOnlineLesson({ lesson_format: 'online' }), true);
    assert.equal(isOnlineLesson({ lesson_format: 'offline' }), false);
  });

  it('blocks join too early and allows during window', () => {
    const early = canStartVideoLesson(
      { lesson_format: 'online', date: '2026-07-28', start_time: '12:00', duration: 60 },
      new Date(2026, 6, 28, 11, 40),
    );
    assert.equal(early.ok, false);
    assert.equal(early.reason, 'too_early');

    const during = canStartVideoLesson(
      { lesson_format: 'online', date: '2026-07-28', start_time: '12:00', duration: 60 },
      new Date(2026, 6, 28, 11, 55),
    );
    assert.equal(during.ok, true);
  });
});

describe('Video lesson UI contract', () => {
  it('registers /lesson/:id/video page', () => {
    const app = readFileSync(join(root, 'App.jsx'), 'utf8');
    assert.match(app, /LessonVideo/);
    assert.match(app, /lesson\/:id\/video/);
  });

  it('uses Russian labels without Meeting/Room/Call', () => {
    const page = readFileSync(join(root, 'pages/LessonVideo.jsx'), 'utf8');
    const teacher = readFileSync(join(root, 'pages/TeacherSchedule.jsx'), 'utf8');
    const student = readFileSync(join(root, 'pages/StudentLessons.jsx'), 'utf8');
    assert.match(page, /Онлайн-урок/);
    assert.match(teacher, /Начать видеоурок/);
    assert.match(student, /Войти в видеоурок/);
    assert.doesNotMatch(page, /\bMeeting\b|\bRoom\b|\bCall\b|Video conference/);
    assert.doesNotMatch(teacher, /Войти на встречу/);
    assert.doesNotMatch(student, /Войти на встречу/);
  });

  it('keeps VideoProvider abstraction on API', () => {
    const iface = readFileSync(
      join(root, '../apps/api/src/modules/video/providers/video-provider.interface.ts'),
      'utf8',
    );
    assert.match(iface, /interface VideoProvider/);
    assert.match(iface, /createRoom/);
    assert.match(iface, /getRoomUrl/);
    assert.match(iface, /generateAccessData/);
    assert.match(iface, /deleteRoom/);
  });
});
