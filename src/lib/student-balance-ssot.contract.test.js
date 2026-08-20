import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatLessonBalance,
  getLessonBalance,
  getTeacherContactLessonBalance,
  lessonBalanceStatColor,
  lessonBalanceTone,
} from './lessonBalance.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Student balance SSOT contract', () => {
  it('forbids reconcile/mirror/dual-write; teacher balance is Student-only', () => {
    const contactBalance = read(
      'apps/api/src/modules/teacher-student-contacts/teacher-student-contact-balance.service.ts',
    );
    const studentBalance = read('apps/api/src/modules/students/student-balance.service.ts');
    const payments = read('apps/api/src/modules/payments/payments.service.ts');
    const contactsService = read(
      'apps/api/src/modules/teacher-student-contacts/teacher-student-contacts.service.ts',
    );
    const paymentModal = read('src/components/payments/PaymentModal.jsx');
    const ownerStudents = read('src/lib/ownerStudents.js');
    const lessonBalanceLib = read('src/lib/lessonBalance.js');

    assert.doesNotMatch(contactBalance, /reconcileLinkedTeacherBalances/);
    assert.doesNotMatch(contactBalance, /mirrorStudentBalanceToContacts/);
    assert.doesNotMatch(contactBalance, /writeCanonicalBalance/);
    assert.match(contactBalance, /only students\.lesson_balance|Teacher \+ link/);
    assert.doesNotMatch(studentBalance, /mirrorToLinkedTeacherContacts/);
    assert.doesNotMatch(studentBalance, /TeacherStudentContactEntity/);
    assert.doesNotMatch(payments, /TeacherStudentContactEntity/);
    assert.doesNotMatch(contactsService, /reconcileLinkedTeacherBalances/);
    assert.match(contactsService, /attachLastLessons/);
    assert.match(contactsService, /schoolById|lessonBalance/);
    assert.doesNotMatch(contactsService, /patch\.lessonBalance/);
    assert.match(contactsService, /Plain DTO|always from linked Student/);
    assert.match(paymentModal, /getTeacherContactLessonBalance|getLessonBalance/);
    assert.doesNotMatch(
      paymentModal,
      /linkedStudent\?\.lesson_balance \?\?[\s\S]*c\.lesson_balance/,
    );
    assert.match(ownerStudents, /getLessonBalance/);
    assert.match(lessonBalanceLib, /students\.lesson_balance/);
    assert.match(contactBalance, /tutor_contact_balances|TutorContactBalanceEntity/);
    const contactEntity = read(
      'apps/api/src/modules/teacher-student-contacts/entities/teacher-student-contact.entity.ts',
    );
    assert.doesNotMatch(contactEntity, /@Column\(\{[^}]*lesson_balance/);
    assert.doesNotMatch(contactEntity, /^\s+lessonBalance:/m);
  });

  it('allows negative lesson balance (debt) without floor-at-zero clamps', () => {
    const studentBalance = read('apps/api/src/modules/students/student-balance.service.ts');
    const contactBalance = read(
      'apps/api/src/modules/teacher-student-contacts/teacher-student-contact-balance.service.ts',
    );
    const payments = read('apps/api/src/modules/payments/payments.service.ts');
    const contactsService = read(
      'apps/api/src/modules/teacher-student-contacts/teacher-student-contacts.service.ts',
    );
    const createDto = read('apps/api/src/modules/students/dto/create-student.dto.ts');
    const updateDto = read('apps/api/src/modules/students/dto/update-student.dto.ts');
    const form = read('src/components/students/StudentFormDialog.jsx');
    const display = read('src/components/students/LessonBalanceDisplay.jsx');

    assert.doesNotMatch(studentBalance, /Math\.max\(\s*0\s*,/);
    assert.doesNotMatch(contactBalance, /Math\.max\(\s*0\s*,/);
    assert.doesNotMatch(payments, /nextBalance\s*<\s*0/);
    assert.doesNotMatch(contactsService, /newBalance\s*<\s*0/);
    const stripComments = (src) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const createDtoCode = stripComments(createDto);
    const updateDtoCode = stripComments(updateDto);
    assert.doesNotMatch(createDtoCode, /@Min\s*\(/);
    assert.doesNotMatch(updateDtoCode, /@Min\s*\(/);
    assert.match(updateDtoCode, /@Type\(\(\)\s*=>\s*Number\)/);
    assert.doesNotMatch(form, /raw\s*>=\s*0/);
    assert.doesNotMatch(form, /min=\{0\}/);
    assert.match(display, /LessonBalanceDisplay/);
    assert.match(display, /debt/);
    assert.match(read('src/lib/lessonBalance.js'), /return 'positive'/);
    assert.doesNotMatch(read('src/lib/lessonBalance.js'), /return 'low'/);

    assert.equal(getLessonBalance({ lesson_balance: -3 }), -3);
    assert.equal(lessonBalanceTone(-1), 'debt');
    assert.equal(lessonBalanceTone(0), 'zero');
    assert.equal(lessonBalanceTone(1), 'positive');
    assert.equal(lessonBalanceTone(2), 'positive');
    assert.equal(lessonBalanceTone(8), 'positive');
    assert.equal(lessonBalanceStatColor(-1), 'rose');
    assert.equal(lessonBalanceStatColor(0), 'muted');
    assert.equal(lessonBalanceStatColor(3), 'emerald');
    assert.equal(formatLessonBalance(-2, { signed: true }), '-2');
    assert.equal(formatLessonBalance(5, { signed: true }), '+5');
  });

  it('key CRM screens render balance via LessonBalanceDisplay', () => {
    const files = [
      'src/pages/UserManagement.jsx',
      'src/pages/StudentDetail.jsx',
      'src/pages/StudentDashboard.jsx',
      'src/pages/LowBalanceStudents.jsx',
      'src/pages/Analytics.jsx',
      'src/components/schedule/LessonModal.jsx',
      'src/components/payments/PaymentModal.jsx',
      'src/components/students/PrivateStudentsNotebook.jsx',
      'src/components/teachers/TeacherDetailModal.jsx',
      'src/components/tutors/TutorLessonModal.jsx',
    ];
    for (const rel of files) {
      assert.match(read(rel), /LessonBalanceDisplay/, `${rel} must use LessonBalanceDisplay`);
    }
  });

  it('getLessonBalance reads Student SSOT and ignores contact fallback in helper', () => {
    assert.equal(getLessonBalance({ lesson_balance: 0 }), 0);
    assert.equal(getLessonBalance({ lessonBalance: 5 }), 5);
    assert.equal(getLessonBalance({ lesson_balance: 1, lessonBalance: 99 }), 1);

    const students = new Map([
      ['s1', { id: 's1', lesson_balance: 7 }],
    ]);
    assert.deepEqual(
      getTeacherContactLessonBalance(
        { id: 'c1', linked_student_id: 's1', lesson_balance: 0 },
        students,
      ),
      { studentId: 's1', balance: 7 },
    );
    assert.deepEqual(
      getTeacherContactLessonBalance(
        { id: 'c1', linked_student_id: 'missing', lesson_balance: 99 },
        students,
      ),
      { studentId: 'missing', balance: null },
    );
  });
});
