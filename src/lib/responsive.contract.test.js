import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('responsive foundation', () => {
  it('declares canonical screens in tailwind config', () => {
    const tw = readFileSync(join(root, '../tailwind.config.js'), 'utf8');
    assert.match(tw, /sm:\s*'640px'/);
    assert.match(tw, /md:\s*'768px'/);
    assert.match(tw, /lg:\s*'1024px'/);
    assert.match(tw, /xl:\s*'1280px'/);
    assert.match(tw, /'2xl':\s*'1536px'/);
  });

  it('exposes responsive primitives and touch tokens', () => {
    assert.match(read('lib/responsive.js'), /BREAKPOINTS/);
    assert.match(read('lib/responsive.js'), /useIsLgUp/);
    assert.match(read('components/responsive/ResponsiveTable.jsx'), /lg:hidden/);
    assert.match(read('components/responsive/ResponsiveDialog.jsx'), /side="bottom"/);
    assert.match(read('components/responsive/PageHeader.jsx'), /sm:flex-row/);
    assert.match(read('components/responsive/PageShell.jsx'), /page-pad/);
    assert.match(read('index.css'), /--touch-min/);
    assert.match(read('index.css'), /\.page-pad/);
    assert.match(read('components/ui/button.jsx'), /min-h-11/);
    assert.match(read('components/ui/input.jsx'), /min-h-11/);
  });

  it('adapts shell, chats, schedule, and lesson video for mobile', () => {
    assert.match(read('Layout.jsx'), /min-h-touch/);
    assert.match(read('pages/Chats.jsx'), /mobilePane/);
    assert.match(read('pages/Chats.jsx'), /backToChatList/);
    assert.match(read('components/chats/ChatMessagePane.jsx'), /ArrowLeft/);
    assert.match(read('components/schedule/SchoolScheduleCalendar.jsx'), /md:hidden/);
    assert.match(read('pages/Schedule.jsx'), /SchoolScheduleCalendar/);
    assert.match(read('pages/LessonVideo.jsx'), /useIsMdUp/);
    assert.match(read('pages/LessonVideo.jsx'), /useIsLgUp/);
    assert.match(read('pages/LessonVideo.jsx'), /side=\{isMdUp \? 'right' : 'bottom'\}/);
    assert.match(read('pages/LessonVideo.jsx'), /h-dvh|min-h-dvh/);
  });

  it('uses card layouts for key tables on small screens', () => {
    assert.match(read('pages/Payments.jsx'), /ResponsiveTable/);
    assert.match(read('pages/AssessmentResults.jsx'), /ResponsiveTable/);
    assert.match(read('pages/TutorStats.jsx'), /ResponsiveTable/);
    assert.match(read('pages/TutorsAnalytics.jsx'), /ResponsiveTable/);
    assert.match(read('pages/TeacherAssessmentResults.jsx'), /ResponsiveTable/);
    assert.match(read('pages/Salary.jsx'), /lg:hidden space-y-3/);
    assert.match(read('pages/LowBalanceStudents.jsx'), /lg:hidden space-y-3/);
    assert.match(read('pages/UserManagement.jsx'), /lg:hidden space-y-3/);
    assert.match(read('components/materials/MaterialTable.jsx'), /lg:hidden divide-y/);
    assert.match(read('components/students/StudentFormDialog.jsx'), /ResponsiveDialog/);
    assert.match(read('components/chats/FindInterlocutorDialog.jsx'), /ResponsiveDialog/);
  });
});
