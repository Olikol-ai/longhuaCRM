import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Payments student picker contract', () => {
  it('uses payment-options API scoped by student access, not creator', () => {
    const studentsApi = read('src/api/students.api.js');
    const paymentsPage = read('src/pages/Payments.jsx');
    const form = read('src/components/payments/PaymentFormDialog.jsx');
    const modal = read('src/components/payments/PaymentModal.jsx');
    const app = read('src/App.jsx');
    const controller = read('apps/api/src/modules/students/students.controller.ts');
    const access = read('apps/api/src/common/access/student-access.service.ts');
    const service = read('apps/api/src/modules/students/students.service.ts');

    assert.match(studentsApi, /paymentOptions|\/students\/payment-options/);
    assert.match(paymentsPage, /paymentOptions/);
    assert.match(paymentsPage, /teacherStudentContacts\.listMine|contacts/);
    assert.match(paymentsPage, /PageHeader|AlertDialog|payments-page/);
    assert.match(paymentsPage, /id: ['"]student['"]/);
    assert.match(form, /paymentOptions/);
    assert.match(form, /student_target_type|Ученик школы|Ученик преподавателя/);
    assert.match(modal, /payment-student-search|Поиск по имени/);
    assert.match(modal, /student_target_type/);
    assert.match(modal, /Ученик школы/);
    assert.match(modal, /Ученик преподавателя/);
    assert.match(modal, /teacher_student_contact_id|linked_student_id|linkedStudentId/);
    assert.match(modal, /ResponsiveDialog/);
    assert.match(app, /Payments[\s\S]*TeacherRoute|TeacherRoute[\s\S]*Payments/);
    assert.match(controller, /payment-options|findPaymentOptions/);
    assert.match(controller, /ParseUUIDPipe/);
    assert.match(controller, /@Roles\('admin', 'teacher'\)/);
    assert.match(access, /listStudentsForPayments/);
    assert.match(access, /never who created|no createdBy/i);
    assert.doesNotMatch(access, /createdByUserId|ownerId|authorId|creatorId/);
    assert.match(service, /assignedTeacherId = teacher\.id/);
    assert.match(service, /findPaymentOptions/);
  });
});
