import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildJitsiConfigOverwrite,
  buildJitsiInterfaceConfigOverwrite,
  canStartVideoLesson,
  isOnlineLesson,
  JITSI_IFRAME_ALLOW,
  lessonVideoPath,
  parseJitsiDomain,
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

  it('parses Jitsi domain and builds External API overrides', () => {
    assert.equal(parseJitsiDomain('https://meet.example.test/room'), 'meet.example.test');
    const config = buildJitsiConfigOverwrite({ subject: 'HSK 2' });
    assert.equal(config.prejoinConfig.enabled, false);
    assert.equal(config.disableDeepLinking, true);
    assert.equal(config.defaultLanguage, 'ru');
    assert.equal(config.enableLobby, false);
    assert.equal(config.subject, 'HSK 2');
    assert.ok(config.toolbarButtons.includes('microphone'));
    assert.ok(config.toolbarButtons.includes('chat'));
    assert.ok(!config.toolbarButtons.includes('invite'));

    const ui = buildJitsiInterfaceConfigOverwrite();
    assert.equal(ui.APP_NAME, 'Longhua');
    assert.equal(ui.MOBILE_APP_PROMO, false);
    assert.match(JITSI_IFRAME_ALLOW, /camera/);
    assert.match(JITSI_IFRAME_ALLOW, /microphone/);
    assert.match(JITSI_IFRAME_ALLOW, /display-capture/);
    assert.match(JITSI_IFRAME_ALLOW, /fullscreen/);
  });
});

describe('Video lesson UI contract', () => {
  it('registers /lesson/:id/video page', () => {
    const app = readFileSync(join(root, 'App.jsx'), 'utf8');
    assert.match(app, /LessonVideo/);
    assert.match(app, /lesson\/:id\/video/);
  });

  it('uses Russian labels and External API embed', () => {
    const page = readFileSync(join(root, 'pages/LessonVideo.jsx'), 'utf8');
    const embed = readFileSync(join(root, 'components/video/JitsiLessonEmbed.jsx'), 'utf8');
    const prejoin = readFileSync(join(root, 'components/video/VideoPrejoin.jsx'), 'utf8');
    const teacher = readFileSync(join(root, 'pages/TeacherSchedule.jsx'), 'utf8');
    const student = readFileSync(join(root, 'pages/StudentLessons.jsx'), 'utf8');
    const layout = readFileSync(join(root, 'Layout.jsx'), 'utf8');

    assert.match(page, /Longhua/);
    assert.match(page, /Китайский язык/);
    assert.match(page, /Войти в урок|Начать урок/);
    assert.match(page, /Завершить урок/);
    assert.match(page, /Материалы/);
    assert.match(page, /Домашнее задание/);
    assert.match(page, /Чат/);
    assert.match(prejoin, /Проверка оборудования/);
    assert.match(prejoin, /Камера/);
    assert.match(prejoin, /Микрофон/);
    assert.match(embed, /JitsiMeetExternalAPI/);
    assert.match(embed, /loadJitsiExternalApi/);
    assert.match(embed, /executeCommand\('displayName'/);
    assert.match(embed, /CRM guest|guest|displayName/);
    assert.match(layout, /LessonVideo/);
    assert.match(teacher, /Начать видеоурок/);
    assert.match(student, /Войти в видеоурок/);

    assert.doesNotMatch(page, /\bMeeting\b|\bRoom\b|\bLogin\b|\bJoin\b|\bLeave\b|Video conference/);
    assert.doesNotMatch(prejoin, /\bMeeting\b|\bRoom\b|\bLogin\b|\bJoin\b/);
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
    assert.match(iface, /externalApiUrl/);
  });
});
