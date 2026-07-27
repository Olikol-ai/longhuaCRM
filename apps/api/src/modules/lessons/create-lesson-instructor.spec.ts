import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLessonDto } from '../lessons/dto/create-lesson.dto';

const TEACHER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TUTOR_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const STUDENT_ID = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

describe('CreateLessonDto instructor ownership', () => {
  it('accepts teacher-owned lesson', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      teacherId: TEACHER_ID,
      primaryStudentId: STUDENT_ID,
      date: '2026-08-01',
      startTime: '10:00',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts tutor-owned lesson', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      tutorId: TUTOR_ID,
      primaryStudentId: STUDENT_ID,
      date: '2026-08-01',
      startTime: '10:00',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects lesson with both teacher and tutor', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      teacherId: TEACHER_ID,
      tutorId: TUTOR_ID,
      primaryStudentId: STUDENT_ID,
      date: '2026-08-01',
      startTime: '10:00',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });

  it('rejects lesson with neither instructor', async () => {
    const dto = plainToInstance(CreateLessonDto, {
      primaryStudentId: STUDENT_ID,
      date: '2026-08-01',
      startTime: '10:00',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });
});
