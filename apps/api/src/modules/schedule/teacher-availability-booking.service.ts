import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { TeacherAvailabilityBookingEntity } from '../../entities/TeacherAvailabilityBooking.entity';
import { TeacherAvailabilitySlotEntity } from '../../entities/TeacherAvailabilitySlot.entity';

export type LessonBookingInput = {
  lessonId: string;
  teacherId: string;
  date: string;
  startTime: string;
  duration: number;
};

@Injectable()
export class TeacherAvailabilityBookingService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createBookingForLesson(
    input: LessonBookingInput,
    manager: EntityManager,
  ): Promise<TeacherAvailabilityBookingEntity> {
    const timeFrom = this.normalizeTime(input.startTime);
    const timeTo = this.addMinutesToTime(timeFrom, Number(input.duration) || 60);

    await this.assertWithinAvailability(
      input.teacherId,
      input.date,
      timeFrom,
      timeTo,
      manager,
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

    const timeFrom = this.normalizeTime(input.startTime);
    const timeTo = this.addMinutesToTime(timeFrom, Number(input.duration) || 60);

    if (
      existing &&
      existing.teacherId === input.teacherId &&
      existing.date === input.date &&
      this.normalizeTime(existing.timeFrom) === timeFrom &&
      this.normalizeTime(existing.timeTo) === timeTo
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

  private async assertWithinAvailability(
    teacherId: string,
    date: string,
    timeFrom: string,
    timeTo: string,
    manager: EntityManager,
  ): Promise<void> {
    const dayOfWeek = this.dayIndexFromDate(date);
    const slotRepo = manager.getRepository(TeacherAvailabilitySlotEntity);
    const slots = await slotRepo.find({
      where: { teacherId, dayOfWeek },
    });

    if (slots.length === 0) {
      throw new BadRequestException(
        'Teacher has no availability configured for this day',
      );
    }

    const fitsSlot = slots.some((slot) =>
      this.rangeContained(
        timeFrom,
        timeTo,
        this.normalizeTime(slot.timeFrom),
        this.normalizeTime(slot.timeTo),
      ),
    );

    if (!fitsSlot) {
      throw new BadRequestException(
        'Lesson time is outside teacher availability',
      );
    }
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
      return this.rangesOverlap(
        timeFrom,
        timeTo,
        this.normalizeTime(booking.timeFrom),
        this.normalizeTime(booking.timeTo),
      );
    });

    if (conflict) {
      throw new BadRequestException(
        'Teacher already has a booking at this time',
      );
    }
  }

  private dayIndexFromDate(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekday === 0 ? 6 : weekday - 1;
  }

  private parseTimeToMinutes(time: string): number {
    const normalized = this.normalizeTime(time);
    const [hours, minutes] = normalized.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private normalizeTime(time: string): string {
    const parts = String(time ?? '00:00').split(':');
    const hours = String(Number(parts[0] ?? 0)).padStart(2, '0');
    const minutes = String(Number(parts[1] ?? 0)).padStart(2, '0');
    return `${hours}:${minutes}:00`;
  }

  private addMinutesToTime(time: string, minutes: number): string {
    const total = this.parseTimeToMinutes(time) + minutes;
    const hours = Math.floor(total / 60) % 24;
    const mins = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
  }

  private rangesOverlap(fromA: string, toA: string, fromB: string, toB: string): boolean {
    const aStart = this.parseTimeToMinutes(fromA);
    const aEnd = this.parseTimeToMinutes(toA);
    const bStart = this.parseTimeToMinutes(fromB);
    const bEnd = this.parseTimeToMinutes(toB);
    return aStart < bEnd && bStart < aEnd;
  }

  private rangeContained(
    innerFrom: string,
    innerTo: string,
    outerFrom: string,
    outerTo: string,
  ): boolean {
    const innerStart = this.parseTimeToMinutes(innerFrom);
    const innerEnd = this.parseTimeToMinutes(innerTo);
    const outerStart = this.parseTimeToMinutes(outerFrom);
    const outerEnd = this.parseTimeToMinutes(outerTo);
    return innerStart >= outerStart && innerEnd <= outerEnd;
  }
}
