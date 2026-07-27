import { readFileSync } from 'fs';
import { join } from 'path';

/** Repo root: apps/api/src/modules/tutors → ../../../../.. */
const root = join(__dirname, '../../../../../');

function read(relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

describe('Tutor isolation contracts', () => {
  it('registers tutor_students and tutor_invite_links migration', () => {
    const migration = read(
      'apps/api/src/database/migrations/1741800000000-TutorStudentsAndInvites.ts',
    );
    expect(migration).toContain('tutor_students');
    expect(migration).toContain('tutor_invite_links');
    expect(migration).toContain('primary_tutor_student_id');
    expect(migration).toContain('invite_tutor_id');
  });

  it('exposes tutor student and invite APIs', () => {
    const controller = read('apps/api/src/modules/tutors/tutors.controller.ts');
    const invites = read('apps/api/src/modules/tutors/tutor-invites.controller.ts');
    expect(controller).toContain(":id/students");
    expect(controller).toContain('me/students');
    expect(invites).toContain("@Controller('tutor-invite-links')");
    expect(invites).toContain('@Post()');
    expect(invites).toContain('@Get()');
  });

  it('frontend has tutor referral and admin tutors pages', () => {
    const pages = read('src/pages.config.js');
    const admin = read('src/pages/AdminPanel.jsx');
    const layout = read('src/Layout.jsx');
    expect(pages).toContain('TutorReferralLinks');
    expect(admin).toContain('AdminTutors');
    expect(layout).toContain('TutorReferralLinks');
  });

  it('tutor lesson payload uses tutor_student_id', () => {
    const payload = read('src/lib/lessonPayload.js');
    const modal = read('src/components/tutors/TutorLessonModal.jsx');
    expect(payload).toContain('primaryTutorStudentId');
    expect(modal).toContain('tutor_student_id');
  });
});
