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
    expect(controller).toContain("@Post(':id/students')");
    expect(controller).toContain("@Get(':id/lessons')");
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

  it('frontend has tutor notebook CRUD and admin tutor cabinet management', () => {
    const pages = read('src/pages.config.js');
    const admin = read('src/pages/AdminPanel.jsx');
    const layout = read('src/Layout.jsx');
    const notebook = read('src/pages/TutorStudents.jsx');
    const api = read('src/api/tutors.api.js');
    const adminTutors = read('src/pages/AdminTutors.jsx');
    const analytics = read('src/pages/TutorsAnalytics.jsx');
    const detail = read('src/pages/AdminTutorDetail.jsx');
    const profile = read('src/pages/TutorProfile.jsx');
    const app = read('src/App.jsx');
    const routing = read('src/lib/routing.js');
    expect(pages).toContain('TutorReferralLinks');
    expect(pages).toContain('TutorProfile');
    expect(admin).toContain('AdminTutors');
    expect(layout).toContain('TutorReferralLinks');
    expect(layout).toContain('TutorProfile');
    expect(notebook).toContain('tutor-notebook-page');
    expect(notebook).toContain('createMyStudent');
    expect(api).toContain('createMyStudent');
    expect(api).toContain('createStudent');
    expect(api).toContain('updateStudent');
    expect(api).toContain('deleteStudent');
    expect(api).toContain('lessons');
    expect(adminTutors).not.toContain('allStudents');
    expect(adminTutors).not.toContain('Ученики репетиторов');
    expect(analytics).toContain('/admin/tutors/');
    expect(analytics).toContain('Ученики');
    expect(detail).toContain('admin-tutor-detail');
    expect(detail).toContain('Профиль');
    expect(detail).toContain('Ученики');
    expect(detail).toContain('Расписание');
    expect(detail).toContain('Статистика');
    expect(detail).toContain('createStudent');
    expect(profile).toContain('tutor-profile-page');
    expect(profile).toContain('Настройки занятий');
    expect(profile).toContain('Направления обучения');
    expect(app).toContain('/admin/tutors/:tutorId');
    expect(app).toContain('TutorProfile');
    expect(routing).toContain('/admin/tutors/');
    expect(routing).toContain('TutorProfile');
  });

  it('tutor lesson payload uses tutor_student_id', () => {
    const payload = read('src/lib/lessonPayload.js');
    const modal = read('src/components/tutors/TutorLessonModal.jsx');
    expect(payload).toContain('primaryTutorStudentId');
    expect(modal).toContain('tutor_student_id');
    expect(modal).toContain('Комментарий');
  });
});
