import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLessonSeriesDto } from './dto/create-lesson-series.dto';

describe('CreateLessonSeriesDto', () => {
  it('accepts series without courseId (schedule-only group)', async () => {
    const dto = plainToInstance(CreateLessonSeriesDto, {
      groupId: '11111111-1111-4111-8111-111111111111',
      teacherId: '22222222-2222-4222-8222-222222222222',
      startDate: '2030-03-04',
      totalLessons: 10,
      slots: [{ dayOfWeek: 1, startTime: '18:30' }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('still accepts courseId when provided', async () => {
    const dto = plainToInstance(CreateLessonSeriesDto, {
      courseId: '33333333-3333-4333-8333-333333333333',
      groupId: '11111111-1111-4111-8111-111111111111',
      teacherId: '22222222-2222-4222-8222-222222222222',
      startDate: '2030-03-04',
      totalLessons: 10,
      startTime: '10:00',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
