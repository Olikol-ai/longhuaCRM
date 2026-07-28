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
    expect(controller).toContain("@Post('me/students')");
    expect(controller).toContain("@Patch('me/students/:studentId')");
    expect(controller).toContain("@Delete('me/students/:studentId')");
    expect(invites).toContain("@Controller('tutor-invite-links')");
    expect(invites).toContain('@Post()');
    expect(invites).toContain('@Get()');
  });

  it('notebook create never wires User or school Student', () => {
    const service = read('apps/api/src/modules/tutors/tutors.service.ts');
    expect(service).toContain('createNotebookStudent');
    expect(service).toContain('userId: null');
    expect(service).toContain('Never creates User / school Student');
    expect(service).not.toMatch(/createNotebookStudent[\s\S]*?studentsRepo/);
  });

  it('frontend has tutor notebook CRUD and admin stats-only tutors page', () => {
    const pages = read('src/pages.config.js');
    const admin = read('src/pages/AdminPanel.jsx');
    const layout = read('src/Layout.jsx');
    const notebook = read('src/pages/TutorStudents.jsx');
    const api = read('src/api/tutors.api.js');
    const adminTutors = read('src/pages/AdminTutors.jsx');
    const analytics = read('src/pages/TutorsAnalytics.jsx');
    expect(pages).toContain('TutorReferralLinks');
    expect(admin).toContain('AdminTutors');
    expect(layout).toContain('TutorReferralLinks');
    expect(notebook).toContain('tutor-notebook-page');
    expect(notebook).toContain('createMyStudent');
    expect(api).toContain('createMyStudent');
    expect(api).toContain('updateMyStudent');
    expect(api).toContain('deleteMyStudent');
    expect(adminTutors).not.toContain('allStudents');
    expect(adminTutors).not.toContain('Ученики репетиторов');
    expect(analytics).toContain('completed_lessons_count');
    expect(analytics).toContain('teaching_hours');
  });

  it('tutor lesson payload uses tutor_student_id', () => {
    const payload = read('src/lib/lessonPayload.js');
    const modal = read('src/components/tutors/TutorLessonModal.jsx');
    expect(payload).toContain('primaryTutorStudentId');
    expect(modal).toContain('tutor_student_id');
    expect(modal).toContain('Комментарий');
  });
});
