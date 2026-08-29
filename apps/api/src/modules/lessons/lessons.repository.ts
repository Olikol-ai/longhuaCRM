import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Not, Repository } from 'typeorm';
import { AttendanceEntity } from './entities/attendance.entity';
import { LessonEntity } from './entities/lesson.entity';

@Injectable()
export class LessonsRepository {
  constructor(
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepo: Repository<AttendanceEntity>,
  ) {}

  findAll(): Promise<LessonEntity[]> {
    return this.lessonRepo.find({
      relations: [
        'teacher',
        'primaryStudent',
        'primaryTutorStudent',
        'primaryTeacherStudentContact',
        'group',
        'recurrenceSeries',
      ],
    });
  }

  findById(id: string): Promise<LessonEntity | null> {
    return this.lessonRepo.findOne({
      where: { id },
      relations: [
        'teacher',
        'primaryStudent',
        'primaryTutorStudent',
        'primaryTeacherStudentContact',
        'group',
        'recurrenceSeries',
      ],
    });
  }

  /**
   * School-calendar date filter for dashboard / day views.
   * Excludes cancelled lessons. No artificial row limit.
   */
  findNonCancelledByDates(dates: string[]): Promise<LessonEntity[]> {
    const uniqueDates = [...new Set(dates.map((d) => String(d).trim()).filter(Boolean))];
    if (uniqueDates.length === 0) {
      return Promise.resolve([]);
    }
    return this.lessonRepo.find({
      where: {
        date: In(uniqueDates),
        status: Not('cancelled' as LessonEntity['status']),
      },
      relations: [
        'teacher',
        'primaryStudent',
        'primaryTutorStudent',
        'primaryTeacherStudentContact',
        'group',
        'recurrenceSeries',
      ],
      order: { date: 'ASC', startTime: 'ASC' },
    });
  }

  countNonCancelledByDate(date: string): Promise<number> {
    return this.lessonRepo.count({
      where: {
        date: String(date).trim(),
        status: Not('cancelled' as LessonEntity['status']),
      },
    });
  }

  save(entity: Partial<LessonEntity>): Promise<LessonEntity> {
    return this.lessonRepo.save(this.lessonRepo.create(entity));
  }

  async update(id: string, data: Partial<LessonEntity>): Promise<LessonEntity | null> {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('LessonsRepository.update requires a concrete lesson id');
    }
    await this.lessonRepo.update({ id: id.trim() }, data);
    return this.findById(id.trim());
  }

  async delete(id: string): Promise<void> {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('LessonsRepository.delete requires a concrete lesson id');
    }
    await this.lessonRepo.delete({ id: id.trim() });
  }

  filter(where: FindOptionsWhere<LessonEntity>): Promise<LessonEntity[]> {
    return this.lessonRepo.find({
      where,
      relations: [
        'teacher',
        'primaryStudent',
        'primaryTutorStudent',
        'primaryTeacherStudentContact',
        'group',
        'recurrenceSeries',
      ],
    });
  }

  findAllAttendance(): Promise<AttendanceEntity[]> {
    return this.attendanceRepo.find();
  }

  findAttendanceById(id: string): Promise<AttendanceEntity | null> {
    return this.attendanceRepo.findOne({ where: { id } });
  }

  saveAttendance(entity: Partial<AttendanceEntity>): Promise<AttendanceEntity> {
    return this.attendanceRepo.save(this.attendanceRepo.create(entity));
  }

  async updateAttendance(
    id: string,
    data: Partial<AttendanceEntity>,
  ): Promise<AttendanceEntity | null> {
    await this.attendanceRepo.update({ id }, data);
    return this.findAttendanceById(id);
  }

  async deleteAttendance(id: string): Promise<void> {
    await this.attendanceRepo.delete({ id });
  }

  filterAttendance(where: FindOptionsWhere<AttendanceEntity>): Promise<AttendanceEntity[]> {
    return this.attendanceRepo.find({ where });
  }
}
