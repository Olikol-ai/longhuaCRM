import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { TeacherAvailabilityBookingEntity } from '../../entities/TeacherAvailabilityBooking.entity';
import { TeacherAvailabilityService } from './teacher-availability.service';

export type LessonBookingInput = {
  lessonId: string;
  teacherId: string;
  date: string;
  startTime: string;
  duration: number;
};

@Injectable()
export class TeacherAvailabilityBookingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly availability: TeacherAvailabilityService,
  ) {}

  async createBookingForLesson(
    input: LessonBookingInput,
    manager: EntityManager,
  ): Promise<TeacherAvailabilityBookingEntity | null> {
    const timeFrom = this.availability.normalizeTime(input.startTime);
    const timeTo = this.availability.addMinutesToTime(
      timeFrom,
      Number(input.duration) || 60,
    );

    const schedule = await this.availability.getTeacherSchedule(input.teacherId);
    if (!schedule.hasSchedule) {
      return null;
    }

    await this.availability.assertAvailableForLesson(
      input.teacherId,
      input.date,
      input.startTime,
      Number(input.duration) || 60,
    );
    await this.assertNoBookingOverlap(
      input.teacherId,
      input.date,
      timeFrom,
      timeTo,
      null,
      manager,
    );

    const repo = manager.getRepository(TeacherAvailabilityBookingEntity);
    const now = new Date();
    return repo.save(
      repo.create({
        id: randomUUID(),
        teacherId: input.teacherId,
        lessonId: input.lessonId,
        date: input.date,
        timeFrom,
        timeTo,
        status: 'active',
        createdDate: now,
        updatedDate: now,
      }),
    );
  }

  async syncBookingForLessonUpdate(
    lessonId: string,
    input: LessonBookingInput,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(TeacherAvailabilityBookingEntity);
    const existing = await repo.findOne({
      where: { lessonId, status: 'active' },
    });

    const timeFrom = this.availability.normalizeTime(input.startTime);
    const timeTo = this.availability.addMinutesToTime(
      timeFrom,
      Number(input.duration) || 60,
    );

    const schedule = await this.availability.getTeacherSchedule(input.teacherId);

    if (!schedule.hasSchedule) {
      if (existing) {
        existing.status = 'cancelled';
        existing.updatedDate = new Date();
        await repo.save(existing);
      }
      return;
    }

    if (
      existing &&
      existing.teacherId === input.teacherId &&
      existing.date === input.date &&
      this.availability.normalizeTime(existing.timeFrom) === timeFrom &&
      this.availability.normalizeTime(existing.timeTo) === timeTo
    ) {
      return;
    }

    if (existing) {
      existing.status = 'cancelled';
      existing.updatedDate = new Date();
      await repo.save(existing);
    }

    await this.createBookingForLesson(input, manager);
  }

  async cancelBookingsForLesson(lessonId: string, manager?: EntityManager): Promise<void> {
    const repo = manager
      ? manager.getRepository(TeacherAvailabilityBookingEntity)
      : this.dataSource.getRepository(TeacherAvailabilityBookingEntity);

    await repo.update(
      { lessonId, status: 'active' },
      { status: 'cancelled', updatedDate: new Date() },
    );
  }

  private async assertNoBookingOverlap(
    teacherId: string,
    date: string,
    timeFrom: string,
    timeTo: string,
    excludeLessonId: string | null,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(TeacherAvailabilityBookingEntity);
    const bookings = await repo.find({
      where: { teacherId, date, status: 'active' },
    });

    const conflict = bookings.find((booking) => {
      if (excludeLessonId && booking.lessonId === excludeLessonId) {
        return false;
      }
      return this.availability.rangesOverlap(
        timeFrom,
        timeTo,
        this.availability.normalizeTime(booking.timeFrom),
        this.availability.normalizeTime(booking.timeTo),
      );
    });

    if (conflict) {
      throw new BadRequestException(
        'Teacher already has a booking at this time',
      );
    }
  }
}
