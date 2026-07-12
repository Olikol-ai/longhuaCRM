import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
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
    return this.lessonRepo.find();
  }

  findById(id: string): Promise<LessonEntity | null> {
    return this.lessonRepo.findOne({ where: { id } });
  }

  save(entity: Partial<LessonEntity>): Promise<LessonEntity> {
    return this.lessonRepo.save(this.lessonRepo.create(entity));
  }

  async update(id: string, data: Partial<LessonEntity>): Promise<LessonEntity | null> {
    await this.lessonRepo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.lessonRepo.delete({ id });
  }

  filter(where: FindOptionsWhere<LessonEntity>): Promise<LessonEntity[]> {
    return this.lessonRepo.find({ where });
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
