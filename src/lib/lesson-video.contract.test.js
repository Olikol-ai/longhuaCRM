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
  mapVideoConferenceError,
  mapLinkQualityScore,
  linkQualityMeta,
} from './lesson-video.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('lesson-video helpers', () => {
  it('maps conference errors to human Russian copy', () => {
    const media = mapVideoConferenceError('NotAllowedError: Permission denied');
    assert.match(media.title, /камер|микрофон/i);
    assert.equal(media.code, 'media_permission');
    const net = mapVideoConferenceError('NetworkError: timeout');
    assert.equal(net.code, 'network');
    const generic = mapVideoConferenceError('');
    assert.ok(generic.description.length > 20);
  });

  it('maps link quality scores to traffic-light labels', () => {
    assert.equal(mapLinkQualityScore(90), 'excellent');
    assert.equal(mapLinkQualityScore(50), 'good');
    assert.equal(mapLinkQualityScore(30), 'fair');
    assert.equal(mapLinkQualityScore(10), 'poor');
    assert.equal(mapLinkQualityScore(0), 'lost');
    assert.equal(linkQualityMeta('excellent').label, 'Отличное');
    assert.equal(linkQualityMeta('lost').tone, 'bad');
  });

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

    assert.equal(config.p2p?.enabled, true);
    assert.equal(config.startSilent, false);
    assert.equal(config.openBridgeChannel, 'websocket');
    assert.equal(config.filmstrip?.disableStageFilmstrip, false);

    const ui = buildJitsiInterfaceConfigOverwrite();
    assert.equal(ui.APP_NAME, 'Longhua');
    assert.equal(ui.SHOW_JITSI_WATERMARK, false);
    assert.equal(ui.MOBILE_APP_PROMO, false);
    assert.equal(ui.AUTO_PIN_LATEST_SCREEN_SHARE, 'remote-only');
    assert.match(JITSI_IFRAME_ALLOW, /camera/);
    assert.match(JITSI_IFRAME_ALLOW, /microphone/);
    assert.match(JITSI_IFRAME_ALLOW, /display-capture/);
    assert.match(JITSI_IFRAME_ALLOW, /fullscreen/);
  });

  it('maps connection status labels in Russian', () => {
    assert.equal(videoConnectionMeta('connecting').label, 'Подключаемся…');
    assert.equal(videoConnectionMeta('connected').label, 'На связи');
    assert.equal(videoConnectionMeta('degraded').label, 'Слабое соединение');
    assert.equal(videoConnectionMeta('reconnecting').label, 'Восстановление…');
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
      countOnlineUniqueParticipants,
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
    assert.equal(countOnlineUniqueParticipants(live), 1);

    // Reconnect ghosts must not inflate the CRM badge (raw Jitsi would say 3–4).
    assert.equal(
      countOnlineUniqueParticipants([
        {
          id: 't-old',
          displayName: 'Учитель',
          online: true,
          crmUserId: 'user-teacher-1',
        },
        {
          id: 't-new',
          displayName: 'Учитель',
          online: true,
          crmUserId: 'user-teacher-1',
        },
        {
          id: 's1',
          displayName: 'Ученик',
          online: true,
          crmUserId: 'user-student-1',
        },
        {
          id: 's1-ghost',
          displayName: 'Ученик',
          online: true,
          crmUserId: 'user-student-1',
        },
      ]),
      2,
    );
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
    const layer = readFileSync(join(root, 'components/video/VideoSessionLayer.jsx'), 'utf8');
    const sessionCtx = readFileSync(join(root, 'lib/VideoSessionContext.jsx'), 'utf8');
    const embed = readFileSync(join(root, 'components/video/JitsiLessonEmbed.jsx'), 'utf8');
    const prejoin = readFileSync(join(root, 'components/video/VideoPrejoin.jsx'), 'utf8');
    const controls = readFileSync(join(root, 'components/video/LessonVideoControls.jsx'), 'utf8');
    const rail = readFileSync(join(root, 'components/video/LessonVideoSideRail.jsx'), 'utf8');
    const teacher = readFileSync(join(root, 'pages/TeacherSchedule.jsx'), 'utf8');
    const teacherCalendar = readFileSync(
      join(root, 'components/schedule/SchoolScheduleCalendar.jsx'),
      'utf8',
    );
    const student = readFileSync(join(root, 'pages/StudentLessons.jsx'), 'utf8');
    const layout = readFileSync(join(root, 'Layout.jsx'), 'utf8');
    const app = readFileSync(join(root, 'App.jsx'), 'utf8');

    assert.match(page, /lesson-video-page/);
    assert.match(page, /Китайский язык/);
    assert.match(page, /Войти в урок|Начать урок/);
    assert.match(page, /startSession|useVideoSession/);
    assert.match(layer, /LessonVideoSideRail/);
    assert.match(layer, /LessonVideoControls/);
    assert.match(controls, /Завершить|Выйти/);
    assert.match(rail, /Материалы/);
    assert.match(rail, /Домашнее задание|ДЗ/);
    assert.match(rail, /Чат/);
    assert.doesNotMatch(rail, /Посещаемость|id: 'info'|id: 'participants'|id: 'attendance'/);
    const people = readFileSync(
      join(root, 'components/video/LessonVideoParticipantsPanel.jsx'),
      'utf8',
    );
    const attendance = readFileSync(
      join(root, 'components/video/LessonVideoAttendancePanel.jsx'),
      'utf8',
    );
    const infoPanel = readFileSync(
      join(root, 'components/video/LessonVideoInfoPanel.jsx'),
      'utf8',
    );
    const shareBar = readFileSync(
      join(root, 'components/video/LessonVideoScreenShareBar.jsx'),
      'utf8',
    );
    const sharePreview = readFileSync(
      join(root, 'components/video/LessonVideoSharePreview.jsx'),
      'utf8',
    );
    assert.match(people, /data-testid="lesson-video-participants"/);
    assert.match(people, /mergeRosterWithPresence|LessonVideoParticipantDevices/);
    assert.match(people, /онлайн|офлайн|Закрепить|Pin|handRaised|Рука/);
    assert.match(attendance, /data-testid="lesson-video-attendance"/);
    assert.match(attendance, /attendance-suggest-present|Рекомендуем: Был/);
    assert.match(attendance, /Уважительная причина|Опоздал/);
    assert.match(infoPanel, /lesson-video-info|Информация|Урок:/);
    assert.match(layer, /LessonVideoParticipantsPanel|LessonVideoAttendancePanel|LessonVideoInfoPanel/);
    assert.match(layer, /canManageAttendance|attendanceOpen|settingsOpen/);
    assert.match(layer, /onPresenceChange|livePresence|setLivePresence/);
    assert.match(embed, /onPresenceChange|getParticipantsInfo|participantJoined/);
    assert.match(embed, /countOnlineUniqueParticipants/);
    assert.doesNotMatch(embed, /getNumberOfParticipants\s*\(/);
    assert.match(embed, /unlockRemoteAudio|onAudioUnlockNeeded/);
    assert.match(embed, /setAttribute\(\s*['"]allow['"][\s\S]*autoplay/);
    assert.match(layer, /lesson-video-audio-unlock|Нажмите, чтобы включить звук/);
    assert.match(
      readFileSync(join(root, 'lib/lesson-video.js'), 'utf8'),
      /countOnlineUniqueParticipants|startSilent:\s*false/,
    );
    assert.match(prejoin, /Проверка оборудования/);
    assert.match(prejoin, /Камера/);
    assert.match(prejoin, /Микрофон/);
    assert.match(prejoin, /Соединение|Интернет/);
    assert.match(prejoin, /Проверить снова/);
    assert.match(prejoin, /RefreshCw|lesson-video-recheck/);
    assert.match(prejoin, /Проверка…|Проверено|Ошибка/);
    assert.match(prejoin, /Работает|Не найден|Хорошее|Проблемы/);
    assert.match(prejoin, /min-h-11|min-h-12/);
    assert.match(prejoin, /bg-card|text-card-foreground|border-border/);
    assert.doesNotMatch(prejoin, /useTheme|isDark|prefers-color-scheme|neutral-950/);
    assert.match(page, /Не удалось подключиться к видеоконференции|Не удалось подключиться к видеоуроку/);
    assert.match(page, /Повторить подключение|Повторить/);
    assert.match(embed, /joinedOnceRef|conferenceFailed|connectionFailed/);
    assert.match(embed, /isTransientVideoError|videoDiag|transient/);
    assert.match(embed, /JitsiMeetExternalAPI/);
    assert.match(embed, /loadJitsiExternalApi/);
    assert.match(embed, /executeCommand\('displayName'/);
    assert.match(embed, /displayName/);
    assert.match(embed, /Подключение к видеоконференции/);
    assert.match(embed, /onConnectionStatus|connectionInterrupted/);
    assert.match(embed, /Intentionally omit jwt|room identity only/);
    assert.match(embed, /crmTheme/);
    assert.match(layer, /useTheme|data-theme/);
    assert.match(layer, /crmTheme=\{theme/);
    assert.match(layer, /bg-background|bg-card/);
    assert.match(layer, /LessonVideoFilmstrip|remoteOrLocalShare/);
    assert.match(layer, /transient|refreshSessionToken/);
    assert.match(sessionCtx, /refreshSessionToken|tokenExpiresAt/);
    assert.doesNotMatch(layer, /isDark|neutral-950|prefers-color-scheme/);
    assert.match(controls, /bg-card\/95|border-border/);
    assert.doesNotMatch(controls, /neutral-950|bg-black\/|isDark/);
    assert.match(rail, /bg-card|border-border|text-muted-foreground/);
    assert.doesNotMatch(rail, /isDark|neutral-950|useTheme/);
    assert.match(page, /startSession/);
    assert.match(layer, /jitsiRef|resize/);
    assert.match(layout, /LessonVideo/);
    assert.doesNotMatch(layout, /LessonVideo[\s\S]*bg-slate-950/);
    assert.match(teacher, /SchoolScheduleCalendar/);
    assert.match(teacherCalendar, /Начать видеоурок/);
    assert.match(student, /Войти в видеоурок/);

    assert.match(layer, /videoConnectionMeta|lesson-video-connection/);
    assert.match(layer, /useIsLgUp/);
    assert.doesNotMatch(layer, /DESKTOP_RAIL_WIDTH|lesson-rail-w|desktopRailVisible/);
    assert.match(layer, /side=\{isDesktop|side="right"|side="bottom"/);
    assert.match(layer, /openStudyPanel|onOpenChat/);
    assert.match(controls, /DockButton|h-12|Участники|Свернуть|Настройки/);
    assert.match(controls, /Завершить|Выйти/);
    assert.match(controls, /LessonVideoParticipantsPanel|Popover/);
    assert.match(controls, /min-h-11|h-12|h-\[3\.25rem\]/);
    assert.doesNotMatch(controls, /overflow-x-auto|Посещаемость|DockRow/);
    assert.match(people, /преподаватель|репетитор|ученик/i);
    assert.match(rail, /activeTab|onActiveTabChange/);
    assert.match(rail, /openMaterial|lesson-video-materials/);
    assert.match(rail, /onRequestNavigate|chatPanelVisible/);
    assert.doesNotMatch(rail, /onPinParticipant|mergeRosterWithPresence/);
    assert.doesNotMatch(rail, /Разрешите всплывающие окна/);
    assert.doesNotMatch(rail, /window\.open\(/);
    assert.match(app, /VideoSessionProvider|VideoSessionLayer/);
    assert.match(page, /startSession|useVideoSession|мини/i);
    assert.match(sessionCtx, /minimize|expand|startSession|endSession|beforeunload/);
    assert.match(sessionCtx, /enterPipMode|exitPipMode|pip/);
    assert.match(sessionCtx, /localStorage|lh-crm-video-mini-pos|computeMiniSize/);
    assert.match(layer, /lesson-video-mini|Свернуть урок|toggleShareScreen|useDocumentVideoPiP|documentPictureInPicture|Поверх окон|Вынести видео поверх окон/);
    assert.match(layer, /lesson-video-mini-people|participants/);
    assert.match(layer, /overflow-x-hidden|max-w-\[100vw\]/);
    assert.match(layer, /VideoScreenShareAudioHint/);
    assert.match(layer, /LessonVideoLeaveDialog|LessonVideoChatToast|LessonVideoScreenShareBar/);
    assert.match(layer, /LessonVideoSharePreview|shareLabel|shareStartedAt/);
    assert.match(layer, /LessonVideoLinkQuality|onLinkQualityChanged|linkQuality/);
    assert.match(layer, /pinParticipant|setLargeVideoParticipant/);
    assert.match(shareBar, /Вы демонстрируете|Остановить|Сменить источник|lesson-video-share-timer/);
    assert.match(sharePreview, /lesson-video-share-preview|Видят ученики/);
    assert.match(embed, /removeListener|devicechange|connectionQualityChanged|raiseHandUpdated/);
    assert.match(rail, /AuthenticatedAudio|sendAudioFile|audio\/\*/);
    assert.match(rail, /flex-wrap/);
    assert.doesNotMatch(rail, /overflow-x-auto/);
    assert.doesNotMatch(rail, /Link to=\{materialsPath\}|<Link to=\{materialsPath\}/);
    assert.doesNotMatch(rail, /asChild[\s\S]*materialsPath/);
    assert.doesNotMatch(layer, /Параметры производительности/);
    assert.doesNotMatch(controls, /Параметры производительности/);
    assert.match(page, /crmUserId|crmEmail/);
    assert.match(layer, /onRequestNavigate|minimize/);
    assert.match(embed, /crmUserId|setParticipantProperty|coalesceLivePresence/);
    const shareHint = readFileSync(
      join(root, 'components/video/VideoScreenShareAudioHint.jsx'),
      'utf8',
    );
    assert.match(shareHint, /Передавать звук|Share tab audio|вкладк/i);
    assert.match(shareHint, /type="checkbox"|lesson-video-share-audio-checkbox/);
    const helpersSrc = readFileSync(join(root, 'lib/lesson-video.js'), 'utf8');
    assert.match(helpersSrc, /SHOW_PERFORMANCE_SETTINGS:\s*false|MAIN_TOOLBAR_BUTTONS/);

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
