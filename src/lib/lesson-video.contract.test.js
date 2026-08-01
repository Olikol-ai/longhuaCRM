import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildJitsiConfigOverwrite,
  buildJitsiInterfaceConfigOverwrite,
  canStartVideoLesson,
  findLivePresence,
  isOnlineLesson,
  JITSI_IFRAME_ALLOW,
  lessonVideoPath,
  normalizeVideoDisplayName,
  parseJitsiDomain,
  participantConnectionLabel,
  shouldSuggestPresent,
  ATTENDANCE_SUGGEST_MS,
  videoConnectionMeta,
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
    assert.equal(config.toolbarButtons.length, 0);
    assert.ok(!config.toolbarButtons.includes('invite'));

    const ui = buildJitsiInterfaceConfigOverwrite();
    assert.equal(ui.APP_NAME, 'Longhua');
    assert.equal(ui.MOBILE_APP_PROMO, false);
    assert.match(JITSI_IFRAME_ALLOW, /camera/);
    assert.match(JITSI_IFRAME_ALLOW, /microphone/);
    assert.match(JITSI_IFRAME_ALLOW, /display-capture/);
    assert.match(JITSI_IFRAME_ALLOW, /fullscreen/);
  });

  it('maps connection status labels in Russian', () => {
    assert.equal(videoConnectionMeta('connecting').label, 'Подключение…');
    assert.equal(videoConnectionMeta('connected').label, 'Подключено');
    assert.equal(videoConnectionMeta('degraded').label, 'Проблемы соединения');
    assert.equal(videoConnectionMeta('reconnecting').label, 'Переподключение…');
  });

  it('matches Jitsi display names and suggests present after long connection', () => {
    assert.equal(normalizeVideoDisplayName('Иван Петров (ученик)'), 'иван петров');
    const live = [
      {
        id: '1',
        displayName: 'Иван Петров (ученик)',
        online: true,
        sessionStart: Date.now() - ATTENDANCE_SUGGEST_MS - 1000,
        accumulatedMs: 0,
      },
    ];
    assert.equal(findLivePresence('Иван Петров', live)?.id, '1');
    assert.equal(shouldSuggestPresent(live[0]), true);
    assert.equal(
      participantConnectionLabel({ online: true, presence: live[0] }),
      'в конференции',
    );
    assert.equal(
      participantConnectionLabel({ online: false, presence: { leftAt: Date.now() } }),
      'отключился',
    );
  });

  it('dedupes CRM roster vs Jitsi guest and reconnects by identity', async () => {
    const {
      coalesceLivePresence,
      mergeRosterWithPresence,
    } = await import('./lesson-video.js');

    const live = coalesceLivePresence([
      {
        id: 'old-jid',
        displayName: 'Бобик Пупка (ученик)',
        online: false,
        leftAt: Date.now() - 60_000,
        accumulatedMs: 120_000,
      },
      {
        id: 'new-jid',
        displayName: 'Бобик Пупка (ученик)',
        online: true,
        sessionStart: Date.now(),
        accumulatedMs: 0,
        crmUserId: 'user-student-1',
      },
    ]);
    assert.equal(live.length, 1);
    assert.equal(live[0].online, true);
    assert.equal(live[0].id, 'new-jid');

    const merged = mergeRosterWithPresence(
      [
        {
          role: 'teacher',
          name: 'Янчиленко Мария',
          user_id: 'user-teacher-1',
        },
        {
          role: 'student',
          name: 'Бобик Пупка',
          user_id: 'user-student-1',
          student_id: 'stu-1',
        },
      ],
      [
        {
          id: 't1',
          displayName: 'Янчиленко Мария (преподаватель)',
          online: true,
          crmUserId: 'user-teacher-1',
        },
        {
          id: 's-offline',
          displayName: 'Бобик Пупка (ученик)',
          online: false,
          leftAt: Date.now() - 10_000,
        },
        {
          id: 's-online',
          displayName: 'Бобик Пупка (ученик)',
          online: true,
          crmUserId: 'user-student-1',
        },
      ],
    );

    assert.equal(merged.length, 2);
    assert.equal(merged.filter((r) => r.role === 'guest').length, 0);
    const student = merged.find((r) => r.role === 'student');
    assert.equal(student.online, true);
    assert.equal(student.presence?.id, 's-online');
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
    const controls = readFileSync(join(root, 'components/video/LessonVideoControls.jsx'), 'utf8');
    const rail = readFileSync(join(root, 'components/video/LessonVideoSideRail.jsx'), 'utf8');
    const teacher = readFileSync(join(root, 'pages/TeacherSchedule.jsx'), 'utf8');
    const student = readFileSync(join(root, 'pages/StudentLessons.jsx'), 'utf8');
    const layout = readFileSync(join(root, 'Layout.jsx'), 'utf8');

    assert.match(page, /lesson-video-page/);
    assert.match(page, /Китайский язык/);
    assert.match(page, /Войти в урок|Начать урок/);
    assert.match(page, /LessonVideoSideRail/);
    assert.match(page, /LessonVideoControls/);
    assert.match(controls, /Завершить/);
    assert.match(rail, /Материалы/);
    assert.match(rail, /Домашнее задание|ДЗ/);
    assert.match(rail, /Чат/);
    assert.match(rail, /Посещаемость/);
    assert.match(rail, /canManageAttendance/);
    assert.match(rail, /lesson-video-attendance/);
    assert.match(rail, /attendance-suggest-present|Рекомендуем: Был/);
    assert.match(rail, /Уважительная причина/);
    assert.match(rail, /Опоздал/);
    // Attendance actions stay on the attendance tab, not the participants roster.
    assert.match(rail, /tab === 'attendance'/);
    assert.match(rail, /tab === 'participants'/);
    assert.match(rail, /data-testid="lesson-video-participants"/);
    assert.match(rail, /data-testid="lesson-video-attendance"/);
    const participantsBlock = rail.slice(
      rail.indexOf("tab === 'participants'"),
      rail.indexOf("tab === 'attendance'"),
    );
    assert.doesNotMatch(participantsBlock, /Был|Не был|Опоздал|Уважительная причина/);
    assert.match(page, /canManageAttendance/);
    assert.match(page, /onPresenceChange|livePresence/);
    assert.match(embed, /onPresenceChange|getParticipantsInfo|participantJoined/);
    assert.match(prejoin, /Проверка оборудования/);
    assert.match(prejoin, /Камера/);
    assert.match(prejoin, /Микрофон/);
    assert.match(prejoin, /Соединение|Интернет/);
    assert.match(prejoin, /Проверить снова/);
    assert.match(prejoin, /RefreshCw|lesson-video-recheck/);
    assert.match(prejoin, /Проверка…|Проверено|Ошибка/);
    assert.match(prejoin, /Работает|Не найден|Хорошее|Проблемы/);
    assert.match(prejoin, /min-h-11|min-h-12/);
    // Prejoin inherits CRM ThemeContext via design tokens — no local theme picker.
    assert.match(prejoin, /bg-card|text-card-foreground|border-border/);
    assert.doesNotMatch(prejoin, /useTheme|isDark|prefers-color-scheme|neutral-950/);
    assert.match(page, /Не удалось подключиться к видеоконференции/);
    assert.match(page, /lesson-video-retry|Повторить/);
    assert.match(embed, /joinedOnceRef|conferenceFailed|connectionFailed/);
    assert.match(embed, /JitsiMeetExternalAPI/);
    assert.match(embed, /loadJitsiExternalApi/);
    assert.match(embed, /executeCommand\('displayName'/);
    assert.match(embed, /displayName/);
    assert.match(embed, /Подключение к видеоконференции/);
    assert.match(embed, /onConnectionStatus|connectionInterrupted/);
    // Must not remount conference when jwt / displayName props change.
    assert.match(embed, /Intentionally omit jwt|room identity only/);
    assert.match(embed, /crmTheme/);
    assert.match(page, /useTheme|data-theme/);
    assert.match(page, /crmTheme=\{theme/);
    assert.match(page, /bg-background|bg-card/);
    assert.doesNotMatch(page, /isDark|neutral-950|prefers-color-scheme/);
    assert.match(controls, /bg-card\/95|border-border/);
    assert.doesNotMatch(controls, /neutral-950|bg-black\/|isDark/);
    assert.match(rail, /bg-card|border-border|text-muted-foreground/);
    assert.doesNotMatch(rail, /isDark|neutral-950|useTheme/);
    assert.match(page, /sessionJwt|sessionJwtRef/);
    assert.match(page, /jitsiRef\.current\?\.resize/);
    assert.match(layout, /LessonVideo/);
    assert.doesNotMatch(layout, /LessonVideo[\s\S]*bg-slate-950/);
    assert.match(teacher, /Начать видеоурок/);
    assert.match(student, /Войти в видеоурок/);

    assert.match(page, /videoConnectionMeta|lesson-video-connection/);
    assert.match(page, /useIsLgUp/);
    assert.match(page, /grid-cols-\[minmax\(0,1fr\)/);
    assert.match(page, /DESKTOP_RAIL_WIDTH|lesson-rail-w/);
    assert.match(page, /side="bottom"/);
    assert.match(page, /openSheetTab|lesson-video-dock-chat/);
    assert.match(controls, /flex-col|DockRow|min-h-11/);
    assert.match(controls, /Завершить/);
    assert.match(controls, /Посещаемость|Участники|Настройки|ДЗ/);
    assert.match(controls, /min-h-11|min-h-12/);
    assert.doesNotMatch(controls, /overflow-x-auto|max-w-\[calc\(100vw/);
    assert.match(rail, /участник|преподаватель|репетитор|ученик/i);
    assert.match(rail, /mergeRosterWithPresence/);
    assert.match(rail, /activeTab|onActiveTabChange/);
    assert.match(rail, /openMaterial|lesson-video-materials/);
    assert.match(rail, /openCrmInNewTab|noopener/);
    // In-app Link navigation away from /lesson/:id/video would dispose Jitsi.
    assert.doesNotMatch(rail, /Link to=\{materialsPath\}|<Link to=\{materialsPath\}/);
    assert.doesNotMatch(rail, /asChild[\s\S]*materialsPath/);
    assert.match(page, /crmUserId|crmEmail/);
    assert.match(page, /Only swaps SidePanel content|never remount Jitsi/);
    assert.match(embed, /crmUserId|setParticipantProperty|coalesceLivePresence/);

    assert.doesNotMatch(page, /\bMeeting\b|\bRoom\b|\bLogin\b|\bJoin\b|\bLeave\b|Video conference/);
    assert.doesNotMatch(prejoin, /\bMeeting\b|\bRoom\b|\bLogin\b|\bJoin\b/);
    assert.doesNotMatch(teacher, /Войти на встречу/);
    assert.doesNotMatch(student, /Войти на встречу/);
  });

  it('inherits CRM theme and never auto-picks OS scheme', () => {
    const themeCtx = readFileSync(join(root, 'lib/ThemeContext.jsx'), 'utf8');
    const helpers = readFileSync(join(root, 'lib/lesson-video.js'), 'utf8');
    assert.match(themeCtx, /localStorage\.getItem\("theme"\)/);
    assert.match(themeCtx, /return "light"/);
    assert.doesNotMatch(themeCtx, /prefers-color-scheme|matchMedia/);
    assert.match(helpers, /colorScheme: crmTheme/);
    assert.match(helpers, /Never leave as "normal"|never leave as "normal"/i);
    const configLight = buildJitsiConfigOverwrite({ crmTheme: 'light' });
    const configDark = buildJitsiConfigOverwrite({ crmTheme: 'dark' });
    assert.equal(configLight.colorScheme, 'light');
    assert.equal(configDark.colorScheme, 'dark');
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
