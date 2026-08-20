import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Teacher-created student edit save contract', () => {
  it('refreshes open card after contact update and syncs Student ↔ contact', () => {
    const notebook = read('src/components/students/PrivateStudentsNotebook.jsx');
    const form = read('src/components/students/StudentFormDialog.jsx');
    const studentsService = read('apps/api/src/modules/students/students.service.ts');
    const contactsService = read(
      'apps/api/src/modules/teacher-student-contacts/teacher-student-contacts.service.ts',
    );

    assert.match(notebook, /loadContactDetail\(savedContactId\)/);
    assert.match(notebook, /Изменения успешно сохранены/);
    assert.match(notebook, /Не удалось сохранить/);
    assert.match(form, /await onSave/);
    assert.match(form, /Изменения успешно сохранены/);
    assert.match(form, /userFacingError/);
    assert.match(studentsService, /syncLinkedContactProfileFromStudent/);
    assert.match(contactsService, /syncLinkedContactProfileFromStudent/);
    assert.match(contactsService, /name: saved\.name/);
    assert.match(contactsService, /linkedStudentId/);
  });
});
