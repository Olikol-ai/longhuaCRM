/**
 * Live ICE/RTP evidence collector for teacher↔student (Playwright).
 * PASS criteria require media_path telemetry + optional human confirmation flags.
 *
 * Usage:
 *   BASE_URL=https://lk.longhuachinese.online \
 *   LESSON_ID=... TEACHER_JWT=... STUDENT_JWT=... \
 *   node scripts/live-media-ice-evidence.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import crypto from 'crypto';

const BASE = (process.env.BASE_URL || 'https://lk.longhuachinese.online').replace(/\/$/, '');
const LESSON_ID =
  process.env.LESSON_ID ||
  (fs.existsSync('/tmp/video-verify-lesson.id')
    ? fs.readFileSync('/tmp/video-verify-lesson.id', 'utf8').trim()
    : '');
const TEACHER_JWT =
  process.env.TEACHER_JWT ||
  (fs.existsSync('/tmp/teacher.jwt.live')
    ? fs.readFileSync('/tmp/teacher.jwt.live', 'utf8').trim()
    : '');
const STUDENT_JWT =
  process.env.STUDENT_JWT ||
  (fs.existsSync('/tmp/student.jwt.live')
    ? fs.readFileSync('/tmp/student.jwt.live', 'utf8').trim()
    : '');
const WAIT_MS = Number(process.env.EVIDENCE_WAIT_MS || 45000);

if (!LESSON_ID || !TEACHER_JWT || !STUDENT_JWT) {
  console.error('Need LESSON_ID, TEACHER_JWT, STUDENT_JWT');
  process.exit(2);
}

async function openRole(browser, token, label) {
  const ctx = await browser.newContext({
    permissions: ['camera', 'microphone'],
    viewport: { width: 1280, height: 800 },
  });
  await ctx.grantPermissions(['camera', 'microphone'], { origin: BASE });
  const page = await ctx.newPage();
  const mediaEvents = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('longhua-media-telemetry') ||
      text.includes('media_path_rtp') ||
      text.includes('[video-diag]')
    ) {
      mediaEvents.push({ t: new Date().toISOString(), text: text.slice(0, 800) });
    }
  });
  await page.addInitScript((t) => {
    localStorage.setItem('longhua_access_token', t);
    window.__lhMediaFromParent = [];
    window.addEventListener('message', (ev) => {
      if (ev?.data?.source === 'longhua-jitsi-media-telemetry') {
        window.__lhMediaFromParent.push({
          t: new Date().toISOString(),
          ...ev.data.payload,
        });
        if (window.__lhMediaFromParent.length > 30) {
          window.__lhMediaFromParent.shift();
        }
      }
    });
  }, token);
  return { ctx, page, label, mediaEvents };
}

async function join(page) {
  await page.goto(`${BASE}/lesson/${LESSON_ID}/video`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForTimeout(2500);
  const btn = page.getByRole('button', {
    name: /Начать урок|Войти в урок|Повторить/i,
  }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
  }
}

function summarizeSnapshots(snaps) {
  if (!snaps?.length) return null;
  const last = snaps[snaps.length - 1];
  const c = last.classification || {};
  const pcs = last.peerConnections || [];
  const candTypes = [];
  for (const pc of pcs) {
    if (pc.localCandidate?.type) candTypes.push(`local:${pc.localCandidate.type}`);
    if (pc.remoteCandidate?.type) candTypes.push(`remote:${pc.remoteCandidate.type}`);
  }
  return {
    classification: c.likelyCase || null,
    localAudioSending: c.localAudioSending ?? null,
    localVideoSending: c.localVideoSending ?? null,
    remoteAudioReceiving: c.remoteAudioReceiving ?? null,
    remoteVideoReceiving: c.remoteVideoReceiving ?? null,
    iceConnected: c.iceConnected ?? null,
    iceFailed: c.iceFailed ?? null,
    iceStates: pcs.map((p) => p.iceConnectionState),
    connectionStates: pcs.map((p) => p.connectionState),
    candidateTypes: [...new Set(candTypes)],
    usesRelay: candTypes.some((t) => t.includes('relay')),
    outboundAudioPackets: pcs[0]?.outbound?.audio?.packetsSent ?? null,
    outboundVideoPackets: pcs[0]?.outbound?.video?.packetsSent ?? null,
    inboundAudioPackets: pcs[0]?.inbound?.audio?.packetsReceived ?? null,
    inboundVideoPackets: pcs[0]?.inbound?.video?.packetsReceived ?? null,
  };
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const teacher = await openRole(browser, TEACHER_JWT, 'teacher');
const student = await openRole(browser, STUDENT_JWT, 'student');

await join(teacher.page);
await teacher.page.waitForTimeout(4000);
await join(student.page);
await student.page.waitForTimeout(WAIT_MS);

const teacherSnaps = await teacher.page.evaluate(() => window.__lhMediaFromParent || []);
const studentSnaps = await student.page.evaluate(() => window.__lhMediaFromParent || []);

const report = {
  id: crypto.randomUUID(),
  at: new Date().toISOString(),
  lessonId: LESSON_ID,
  base: BASE,
  note:
    'Automated evidence only. Human hearing/seeing still required for PASS. Mic/cam UI icons ignored.',
  teacher: summarizeSnapshots(teacherSnaps),
  student: summarizeSnapshots(studentSnaps),
  teacherSnapCount: teacherSnaps.length,
  studentSnapCount: studentSnaps.length,
  consoleHints: {
    teacher: teacher.mediaEvents.slice(-10),
    student: student.mediaEvents.slice(-10),
  },
};

const bothSending =
  report.teacher?.localAudioSending &&
  report.teacher?.localVideoSending &&
  report.student?.localAudioSending &&
  report.student?.localVideoSending;
const bothReceiving =
  report.teacher?.remoteAudioReceiving &&
  report.teacher?.remoteVideoReceiving &&
  report.student?.remoteAudioReceiving &&
  report.student?.remoteVideoReceiving;

report.rtpPass = Boolean(bothSending && bothReceiving);
report.humanAvRequired = true;
report.overall =
  report.rtpPass
    ? 'RTP_OK_AWAITING_HUMAN_AV'
    : teacherSnaps.length === 0 && studentSnaps.length === 0
      ? 'NO_TELEMETRY_JOIN_FAILED'
      : 'RTP_INCOMPLETE';

fs.writeFileSync('/tmp/live-media-ice-evidence.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.rtpPass ? 0 : 1);
