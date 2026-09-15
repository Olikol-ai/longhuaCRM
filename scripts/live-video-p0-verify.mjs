/**
 * Live P0 video verification (teacher ↔ student).
 * Does not modify CRM product source — verification runner only.
 *
 * Usage:
 *   BASE_URL=https://lk.longhuachinese.online \
 *   LESSON_ID=... TEACHER_JWT=... STUDENT_JWT=... \
 *   node scripts/live-video-p0-verify.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = (process.env.BASE_URL || 'https://lk.longhuachinese.online').replace(/\/$/, '');
const LESSON_ID = process.env.LESSON_ID || fs.readFileSync('/tmp/video-verify-lesson.id', 'utf8').trim();
const TEACHER_JWT = process.env.TEACHER_JWT || fs.readFileSync('/tmp/teacher.jwt.live', 'utf8').trim();
const STUDENT_JWT = process.env.STUDENT_JWT || fs.readFileSync('/tmp/student.jwt.live', 'utf8').trim();
const SOAK_MS = Number(process.env.SOAK_MS || 12 * 60 * 1000);
const RECONNECT_CYCLES = Number(process.env.RECONNECT_CYCLES || 3);
const RESULTS = {
  startedAt: new Date().toISOString(),
  lessonId: LESSON_ID,
  base: BASE,
  scenarios: {},
  consoleErrors: { teacher: [], student: [] },
  diag: { teacher: [], student: [] },
};

function record(name, data) {
  RESULTS.scenarios[name] = { ...data, at: new Date().toISOString() };
  const mark = data.pass === true ? 'PASS' : data.pass === false ? 'FAIL' : data.pass;
  console.log(`\n=== ${name}: ${mark} ===`);
  if (data.notes) console.log(data.notes);
  if (data.details) console.log(JSON.stringify(data.details, null, 2));
}

async function injectAuth(page, token) {
  await page.addInitScript((t) => {
    localStorage.setItem('longhua_access_token', t);
  }, token);
}

async function attachConsole(page, bucket) {
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || text.includes('[video-diag]')) {
      bucket.push({ type, text: text.slice(0, 500), t: new Date().toISOString() });
    }
  });
  page.on('pageerror', (err) => {
    bucket.push({ type: 'pageerror', text: String(err).slice(0, 500), t: new Date().toISOString() });
  });
  page.on('response', (res) => {
    if (res.status() === 429) {
      bucket.push({
        type: 'http429',
        text: `429 ${res.url().slice(0, 180)}`,
        t: new Date().toISOString(),
      });
    }
  });
}

async function waitForAppReady(page, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await page.evaluate(() => {
      const body = (document.body?.innerText || '').trim();
      const hasJoin = [...document.querySelectorAll('button')].some((b) =>
        /Начать урок|Войти в урок|Повторить/i.test(b.textContent || ''),
      );
      const delegated = Boolean(document.querySelector('[data-testid="lesson-video-page-delegated"]'));
      const shell = Boolean(document.querySelector('[data-testid="lesson-video-connection"]'));
      const authFail = /Не удалось|401|Unauthorized|войти/i.test(body);
      return {
        ready: hasJoin || delegated || shell || body.length > 80,
        hasJoin,
        delegated,
        shell,
        authFail,
        bodyHead: body.slice(0, 300),
      };
    });
    if (st.authFail) return { ...st, timedOut: false };
    if (st.ready) return { ...st, timedOut: false };
    await page.waitForTimeout(1000);
  }
  return { ready: false, timedOut: true };
}

async function joinLesson(page) {
  const path = `/lesson/${LESSON_ID}/video`;
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const ready = await waitForAppReady(page, 90_000);
  if (ready.timedOut) return { already: false, ready };

  const delegated = await page.getByTestId('lesson-video-page-delegated').isVisible().catch(() => false);
  if (delegated) return { already: true, ready };

  const joinBtn = page.getByRole('button', { name: /Начать урок|Войти в урок|Повторить/i }).first();
  const visible = await joinBtn.isVisible().catch(() => false);
  if (visible) {
    await joinBtn.click();
    await page.waitForTimeout(3000);
  }
  return { already: false, ready, joinClicked: visible };
}

async function readUiState(page) {
  return page.evaluate(() => {
    const pill = document.querySelector('[data-testid="lesson-video-connection"]');
    const diagRaw = sessionStorage.getItem('longhua_video_diag');
    let diag = [];
    try {
      diag = diagRaw ? JSON.parse(diagRaw) : [];
    } catch {
      diag = [];
    }
    const path = location.pathname;
    const body = (document.body?.innerText || '').slice(0, 2000);
    const iframeCount = document.querySelectorAll('iframe').length;
    return {
      path,
      connectionLabel: pill?.textContent?.trim() || null,
      hasVideoShell: Boolean(pill) || body.includes('На связи') || body.includes('Восстановление'),
      hasJoinError: body.includes('Не удалось подключиться'),
      iframeCount,
      bodyHead: body.slice(0, 400),
      diagTail: diag.slice(-40),
      diagTypes: diag.map((d) => d.type),
      hasConferenceJoined: diag.some((d) => d.type === 'conference_joined'),
    };
  });
}

async function waitForConnected(page, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await readUiState(page);
    if (
      st.connectionLabel?.includes('На связи') ||
      st.hasConferenceJoined ||
      st.diagTypes.includes('conference_joined')
    ) {
      return st;
    }
    if (st.path && !st.path.includes(`/lesson/${LESSON_ID}/video`) && !st.hasVideoShell) {
      return { ...st, navigatedAway: true };
    }
    await page.waitForTimeout(2000);
  }
  return { ...(await readUiState(page)), timedOut: true };
}

async function presenceSnapshot(page) {
  return page.evaluate(() => {
    const diagRaw = sessionStorage.getItem('longhua_video_diag');
    let diag = [];
    try {
      diag = diagRaw ? JSON.parse(diagRaw) : [];
    } catch {
      /* ignore */
    }
    const syncs = diag.filter((d) => d.type === 'presence_sync');
    const joins = diag.filter((d) => d.type === 'participant_joined');
    const lastSync = syncs[syncs.length - 1] || null;
    return {
      lastUniqueOnline: lastSync?.uniqueOnline ?? null,
      participantJoinedEvents: joins.length,
      softRemountStarts: diag.filter((d) => d.type === 'soft_remount_start').length,
      sessionEnds: diag.filter((d) => d.type === 'session_end').length,
      conferenceLeft: diag.filter((d) => d.type === 'conference_left').length,
      unexpectedLeaves: diag.filter((d) => String(d.type || '').includes('unexpected')).length,
      connectionInterrupted: diag.filter((d) => d.type === 'connection_interrupted').length,
      connectionRestored: diag.filter((d) => d.type === 'connection_restored').length,
      remoteMediaMissing: diag.filter((d) => d.type === 'remote_media_missing').length,
      conferenceJoined: diag.filter((d) => d.type === 'conference_joined').length,
      types: [...new Set(diag.map((d) => d.type))],
    };
  });
}

async function shot(page, name) {
  try {
    await page.screenshot({ path: `/tmp/video-p0-${name}.png`, fullPage: true });
  } catch {
    /* ignore */
  }
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const teacherCtx = await browser.newContext({
  permissions: ['camera', 'microphone'],
  viewport: { width: 1280, height: 800 },
});
const studentCtx = await browser.newContext({
  permissions: ['camera', 'microphone'],
  viewport: { width: 1280, height: 800 },
});

await teacherCtx.grantPermissions(['camera', 'microphone'], { origin: BASE });
await studentCtx.grantPermissions(['camera', 'microphone'], { origin: BASE });

const teacherPage = await teacherCtx.newPage();
const studentPage = await studentCtx.newPage();
await injectAuth(teacherPage, TEACHER_JWT);
await injectAuth(studentPage, STUDENT_JWT);
await attachConsole(teacherPage, RESULTS.consoleErrors.teacher);
await attachConsole(studentPage, RESULTS.consoleErrors.student);

try {
  // --- Scenario 1: join both ---
  const tJoin = await joinLesson(teacherPage);
  const tJoined = await waitForConnected(teacherPage, 150_000);
  await shot(teacherPage, 'teacher-after-join');

  await studentPage.waitForTimeout(2000);
  const sJoin = await joinLesson(studentPage);
  const sJoined = await waitForConnected(studentPage, 150_000);
  await shot(studentPage, 'student-after-join');

  await teacherPage.waitForTimeout(10000);
  const tPres = await presenceSnapshot(teacherPage);
  const sPres = await presenceSnapshot(studentPage);
  const tState = await readUiState(teacherPage);
  const sState = await readUiState(studentPage);

  const bothConnected =
    !tJoined.timedOut &&
    !sJoined.timedOut &&
    !tJoined.navigatedAway &&
    !sJoined.navigatedAway &&
    (tState.hasConferenceJoined || tState.connectionLabel?.includes('На связи')) &&
    (sState.hasConferenceJoined || sState.connectionLabel?.includes('На связи'));

  const uniqueOk =
    (tPres.lastUniqueOnline == null || tPres.lastUniqueOnline <= 2) &&
    (sPres.lastUniqueOnline == null || sPres.lastUniqueOnline <= 2);

  // Prefer seeing 2 unique when both are in; allow null if presence_sync not emitted yet
  const presenceReasonable =
    uniqueOk &&
    (tPres.lastUniqueOnline == null ||
      tPres.lastUniqueOnline >= 1 ||
      tPres.participantJoinedEvents >= 1 ||
      tPres.conferenceJoined >= 1);

  record('1_basic_join', {
    pass: bothConnected && presenceReasonable ? true : false,
    notes:
      'Automated fake media: join + connection + unique presence. Human A/V perception NOT_VERIFIED.',
    details: {
      teacherJoin: tJoin,
      studentJoin: sJoin,
      teacher: {
        label: tState.connectionLabel,
        path: tState.path,
        iframeCount: tState.iframeCount,
        presence: tPres,
        bodyHead: tState.bodyHead,
      },
      student: {
        label: sState.connectionLabel,
        path: sState.path,
        iframeCount: sState.iframeCount,
        presence: sPres,
        bodyHead: sState.bodyHead,
      },
      audioMutualHearing: 'NOT_VERIFIED_AUTOMATED',
      videoMutualSeeing: 'NOT_VERIFIED_AUTOMATED_FAKE_DEVICE',
    },
  });

  if (!bothConnected) {
    record('ABORT_NO_JOIN', {
      pass: false,
      notes: 'Aborting soak/reconnect — conference never joined. Prior soak PASS would be false-positive.',
      details: { tState, sState },
    });
    throw new Error('conference not joined');
  }

  // --- Scenario 2: soak ---
  console.log(`\nSoaking ${SOAK_MS / 60000} minutes...`);
  const soakStart = Date.now();
  let soakNavigated = false;
  let soakSessionEnd = false;
  let soakLostConference = false;
  while (Date.now() - soakStart < SOAK_MS) {
    await teacherPage.waitForTimeout(30_000);
    const ts = await readUiState(teacherPage);
    const ss = await readUiState(studentPage);
    const tp = await presenceSnapshot(teacherPage);
    if (tp.sessionEnds > 0) soakSessionEnd = true;
    if (!ts.hasConferenceJoined && !ts.connectionLabel?.includes('На связи')) {
      soakLostConference = true;
    }
    if (
      (ts.path && !ts.path.includes(`/lesson/${LESSON_ID}/video`) && !ts.hasVideoShell) ||
      (ss.path && !ss.path.includes(`/lesson/${LESSON_ID}/video`) && !ss.hasVideoShell)
    ) {
      if (!ts.hasVideoShell && !ss.hasVideoShell) {
        soakNavigated = true;
        break;
      }
    }
    process.stdout.write('.');
  }
  const afterSoakT = await readUiState(teacherPage);
  const afterSoakP = await presenceSnapshot(teacherPage);
  record('2_soak_10_15min', {
    pass:
      !soakNavigated &&
      !soakSessionEnd &&
      !soakLostConference &&
      afterSoakP.sessionEnds === 0 &&
      (afterSoakT.hasConferenceJoined || afterSoakT.connectionLabel?.includes('На связи')),
    notes: soakNavigated
      ? 'Navigated away / lost video shell during soak'
      : soakSessionEnd
        ? 'session_end observed during soak'
        : soakLostConference
          ? 'Lost conference / connection label during soak'
          : 'Session stayed alive for soak window with active conference',
    details: {
      soakMinutes: SOAK_MS / 60000,
      teacherLabel: afterSoakT.connectionLabel,
      path: afterSoakT.path,
      sessionEnds: afterSoakP.sessionEnds,
      hasVideoShell: afterSoakT.hasVideoShell,
      hasConferenceJoined: afterSoakT.hasConferenceJoined,
    },
  });

  // --- Scenario 3–5: interrupt/reconnect cycles ---
  const cycleResults = [];
  for (let i = 1; i <= RECONNECT_CYCLES; i++) {
    const beforePath = (await readUiState(teacherPage)).path;
    const beforePres = await presenceSnapshot(teacherPage);
    await teacherCtx.setOffline(true);
    await teacherPage.waitForTimeout(5000);
    const mid = await readUiState(teacherPage);
    await teacherCtx.setOffline(false);
    await teacherPage.waitForTimeout(5000);
    const after = await waitForConnected(teacherPage, 120_000);
    await teacherPage.waitForTimeout(5000);
    const pres = await presenceSnapshot(teacherPage);
    const stayedOnLesson =
      after.path?.includes(`/lesson/${LESSON_ID}/video`) || after.hasVideoShell;
    const noEnd = (pres.sessionEnds || 0) === 0;
    const unique = pres.lastUniqueOnline == null || pres.lastUniqueOnline <= 2;
    const interruptedGrew =
      (pres.connectionInterrupted || 0) > (beforePres.connectionInterrupted || 0) ||
      mid.connectionLabel?.includes('прер') ||
      mid.connectionLabel?.includes('Восстанов') ||
      mid.diagTypes.includes('connection_interrupted');
    cycleResults.push({
      cycle: i,
      midLabel: mid.connectionLabel,
      afterLabel: after.connectionLabel,
      stayedOnLesson,
      noEnd,
      unique,
      uniqueOnline: pres.lastUniqueOnline,
      interruptedEvents: pres.connectionInterrupted,
      restoredEvents: pres.connectionRestored,
      softRemounts: pres.softRemountStarts,
      interruptedObserved: interruptedGrew,
      timedOut: Boolean(after.timedOut),
      beforePath,
      afterPath: after.path,
    });
    await shot(teacherPage, `teacher-reconnect-${i}`);
    await teacherPage.waitForTimeout(3000);
  }

  const cyclesPass = cycleResults.every(
    (c) => c.stayedOnLesson && c.noEnd && c.unique && !c.timedOut,
  );
  record('3_5_interrupt_reconnect_cycles', {
    pass: cyclesPass,
    notes:
      'Teacher context setOffline(true/false). Expect stay on lesson, no session_end, ≤2 unique peers, reconnect to connected.',
    details: { cycles: cycleResults },
  });

  // Post-reconnect media/presence checks
  await studentPage.waitForTimeout(3000);
  const postT = await presenceSnapshot(teacherPage);
  const postS = await presenceSnapshot(studentPage);
  const postUiT = await readUiState(teacherPage);
  const postUiS = await readUiState(studentPage);
  record('4_post_reconnect_av_presence', {
    pass:
      Boolean(postUiT.connectionLabel?.includes('На связи') || postUiT.hasConferenceJoined) &&
      Boolean(postUiS.connectionLabel?.includes('На связи') || postUiS.hasConferenceJoined) &&
      (postT.lastUniqueOnline == null || postT.lastUniqueOnline <= 2) &&
      postT.sessionEnds === 0 &&
      postT.remoteMediaMissing === 0,
    notes:
      'Connection + unique participants after cycles. Mute/camera toggles attempted next. Human A/V NOT_VERIFIED.',
    details: {
      teacher: { label: postUiT.connectionLabel, presence: postT },
      student: { label: postUiS.connectionLabel, presence: postS },
      remoteMediaMissing: postT.remoteMediaMissing,
      audioHearing: 'NOT_VERIFIED_AUTOMATED',
      videoSeeing: 'NOT_VERIFIED_AUTOMATED_FAKE_DEVICE',
    },
  });

  // Mute / camera toggles via CRM dock if present
  let muteOk = false;
  let camOk = false;
  try {
    const mic = teacherPage
      .locator(
        '[data-testid="lesson-video-toggle-audio"], button[aria-label*="микрофон" i], button[aria-label*="Mic" i]',
      )
      .first();
    const cam = teacherPage
      .locator(
        '[data-testid="lesson-video-toggle-video"], button[aria-label*="камер" i], button[aria-label*="Video" i]',
      )
      .first();
    if (await mic.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mic.click();
      await teacherPage.waitForTimeout(800);
      await mic.click();
      muteOk = true;
    }
    if (await cam.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cam.click();
      await teacherPage.waitForTimeout(800);
      await cam.click();
      camOk = true;
    }
  } catch (e) {
    console.log('toggle error', e.message);
  }
  record('4b_mute_camera_toggles', {
    pass: muteOk && camOk ? true : muteOk || camOk ? 'PARTIAL' : false,
    details: { muteOk, camOk },
    notes: muteOk || camOk ? 'Dock toggles clicked' : 'Dock toggles not found',
  });

  // --- Scenario 6: screen share ---
  let sharePass = 'NOT_VERIFIED';
  let shareDetails = {};
  try {
    const shareBtn = teacherPage
      .locator(
        '[data-testid="lesson-video-toggle-share"], button[aria-label*="экран" i], button[aria-label*="Share" i], button:has-text("экран")',
      )
      .first();
    if (await shareBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await shareBtn.click();
      await teacherPage.waitForTimeout(3000);
      const afterShare = await readUiState(teacherPage);
      shareDetails = {
        clicked: true,
        label: afterShare.connectionLabel,
        path: afterShare.path,
        stillConnected:
          afterShare.connectionLabel?.includes('На связи') || afterShare.hasConferenceJoined,
      };
      sharePass = shareDetails.stillConnected ? 'PARTIAL' : false;
    } else {
      shareDetails = { clicked: false, reason: 'share button not found' };
      sharePass = 'NOT_VERIFIED';
    }
  } catch (e) {
    shareDetails = { error: e.message };
    sharePass = 'NOT_VERIFIED';
  }
  record('6_screen_share', {
    pass: sharePass,
    notes:
      'Headless getDisplayMedia usually blocked. Verified only that share click did not kill session if attempted.',
    details: shareDetails,
  });

  // Final diag dump
  RESULTS.diag.teacher = (await readUiState(teacherPage)).diagTail;
  RESULTS.diag.student = (await readUiState(studentPage)).diagTail;

  const seriousConsole = [...RESULTS.consoleErrors.teacher, ...RESULTS.consoleErrors.student]
    .filter((e) => e.type === 'error' || e.type === 'pageerror' || e.type === 'http429')
    .filter((e) => !/favicon|ResizeObserver|net::ERR_INTERNET_DISCONNECTED/i.test(e.text));

  record('7_console_diagnostics', {
    pass: seriousConsole.length === 0,
    notes:
      seriousConsole.length === 0
        ? 'No serious pageerrors outside expected offline disconnect noise'
        : 'Serious console errors present — do not PASS on UI alone',
    details: {
      seriousCount: seriousConsole.length,
      seriousSample: seriousConsole.slice(0, 15),
      videoDiagTeacherTypes: [...new Set(RESULTS.diag.teacher.map((d) => d.type))],
      videoDiagStudentTypes: [...new Set(RESULTS.diag.student.map((d) => d.type))],
    },
  });
} catch (err) {
  record('FATAL', { pass: false, notes: String(err?.stack || err) });
} finally {
  RESULTS.finishedAt = new Date().toISOString();
  const out = '/tmp/video-p0-verify-results.json';
  fs.writeFileSync(out, JSON.stringify(RESULTS, null, 2));
  console.log(`\nWrote ${out}`);
  await browser.close();
}

const hardFail = Object.values(RESULTS.scenarios).some((s) => s.pass === false);
process.exit(hardFail ? 1 : 0);
