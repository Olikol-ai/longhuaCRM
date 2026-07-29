import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLessonDto } from './create-lesson.dto';

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const STUDENT_ID = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';

describe('CreateLessonDto teacher student contacts', () => {
  it('accepts individual lesson with private contact', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      teacherId: TEACHER_ID,
      primaryTeacherStudentContactId: CONTACT_ID,
      date: '2026-08-01',
      startTime: '10:00',
      lessonType: 'individual',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects individual lesson without student or contact', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      teacherId: TEACHER_ID,
      date: '2026-08-01',
      startTime: '10:00',
      lessonType: 'individual',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts tutor-owned lesson with private contact', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      tutorId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      primaryTeacherStudentContactId: CONTACT_ID,
      date: '2026-08-01',
      startTime: '10:00',
      lessonType: 'individual',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts teacherStudentContactId alias as a valid individual target', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      teacherId: TEACHER_ID,
      teacherStudentContactId: CONTACT_ID,
      date: '2026-08-01',
      startTime: '10:00',
      lessonType: 'individual',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
