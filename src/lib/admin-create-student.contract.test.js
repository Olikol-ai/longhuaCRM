import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('admin create student with teacher assignment', () => {
  it('UserManagement mounts create-student action and StudentFormDialog', () => {
    const page = readFileSync(join(root, 'src/pages/UserManagement.jsx'), 'utf8');
    assert.match(page, /admin-create-student/);
    assert.match(page, /Создать ученика/);
    assert.match(page, /StudentFormDialog/);
    assert.match(page, /createStudentOpen/);
    assert.match(page, /api\.teachers\.list\(\)/);
  });

  it('AssignedTeacherSelect is a native select fed by api.teachers.list', () => {
    const select = readFileSync(
      join(root, 'src/components/students/AssignedTeacherSelect.jsx'),
      'utf8',
    );
    assert.match(select, /api\.teachers/);
    assert.match(select, /\.list\(\)/);
    assert.match(select, /select/);
    assert.doesNotMatch(select, /from ['"]@\/components\/ui\/select['"]/);
    assert.match(select, /teachersProp !== undefined/);
    assert.match(select, /\[AssignedTeacherSelect\] api\.teachers\.list\(\) result/);
  });

  it('StudentFormDialog does not pass an initial empty teachers array into the select', () => {
    const dialog = readFileSync(
      join(root, 'src/components/students/StudentFormDialog.jsx'),
      'utf8',
    );
    assert.match(dialog, /AssignedTeacherSelect/);
    // Must not force teachers={teachers} while state starts as [] (truthy empty → blank select).
    assert.doesNotMatch(dialog, /teachers=\{teachers\}/);
    assert.match(dialog, /api\.teachers\.list\(\)/);
  });

  it('StudentFormDialog has a single teacher field and no tutor field', () => {
    const dialog = readFileSync(
      join(root, 'src/components/students/StudentFormDialog.jsx'),
      'utf8',
    );
    assert.match(dialog, /AssignedTeacherSelect/);
    assert.match(dialog, /assigned_teacher/);
    assert.match(dialog, /api\.students\.create/);
    assert.match(dialog, /api\.teachers\.list\(\)/);
    assert.doesNotMatch(dialog, /assigned_tutor/);
    assert.doesNotMatch(dialog, /Репетитор/);
    assert.doesNotMatch(dialog, /from ['"]@\/components\/ui\/select['"]/);
  });

  it('UserEditDialog reuses AssignedTeacherSelect for student teacher assignment', () => {
    const edit = readFileSync(
      join(root, 'src/components/users/UserEditDialog.jsx'),
      'utf8',
    );
    assert.match(edit, /AssignedTeacherSelect/);
    assert.match(edit, /api\.students\.update/);
    assert.match(edit, /assigned_teacher/);
  });

  it('backend accepts assignedTeacherId on create', () => {
    const dto = readFileSync(
      join(root, 'apps/api/src/modules/students/dto/create-student.dto.ts'),
      'utf8',
    );
    const service = readFileSync(
      join(root, 'apps/api/src/modules/students/students.service.ts'),
      'utf8',
    );
    assert.match(dto, /assignedTeacherId/);
    assert.match(service, /assertAssignableTeacherId/);
  });
});
