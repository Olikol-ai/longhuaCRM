import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatStudentDisplayName,
  resolveLessonStudentLabel,
  resolveStudentLabel,
} from './studentLabels.js';

describe('formatStudentDisplayName', () => {
  it('prefers name over stale first/last (admin card SSOT)', () => {
    assert.equal(
      formatStudentDisplayName({
        name: 'Бабаева Наталья',
        first_name: 'Наталья',
        last_name: 'Баабева',
      }),
      'Бабаева Наталья',
    );
  });

  it('returns null when Student.name is empty', () => {
    assert.equal(
      formatStudentDisplayName({
        name: '',
        first_name: 'Наталья',
        last_name: 'Бабаева',
      }),
      null,
    );
  });
});

describe('resolveLessonStudentLabel', () => {
  it('prefers live students list over denormalized lesson.student_name', () => {
    const lesson = {
      primary_student_id: 's1',
      student_ids: ['s1'],
      student_name: 'баабева Наталья',
      student_names: ['баабева Наталья'],
      lesson_type: 'individual',
    };
    const students = [
      {
        id: 's1',
        name: 'Бабаева Наталья',
        first_name: 'Наталья',
        last_name: 'Баабева',
      },
    ];
    assert.equal(resolveLessonStudentLabel(lesson, students), 'Бабаева Наталья');
  });
});

describe('resolveStudentLabel', () => {
  it('prefers students list over attendance snapshot', () => {
    assert.equal(
      resolveStudentLabel(
        's1',
        [{ id: 's1', name: 'Бабаева Наталья', last_name: 'Баабева', first_name: 'Наталья' }],
        { student_name: 'баабева Наталья' },
      ),
      'Бабаева Наталья',
    );
  });
});
