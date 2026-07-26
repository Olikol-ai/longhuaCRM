import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import {
  LessonEntity,
  SCHEDULE_OCCUPYING_LESSON_STATUSES,
} from '../lessons/entities/lesson.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { AvailabilityBookingEntity } from './entities/availability-booking.entity';
import { AvailabilitySlotEntity } from './entities/availability-slot.entity';

@Injectable()
export class ScheduleRepository {
  constructor(
    @InjectRepository(AvailabilitySlotEntity)
    private readonly slotRepo: Repository<AvailabilitySlotEntity>,
    @InjectRepository(AvailabilityBookingEntity)
    private readonly bookingRepo: Repository<AvailabilityBookingEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
  ) {}

  findAllSlots(): Promise<AvailabilitySlotEntity[]> {
    return this.slotRepo.find();
  }

  findSlotById(id: string): Promise<AvailabilitySlotEntity | null> {
    return this.slotRepo.findOne({ where: { id } });
  }

  findSlotsByTeacherIds(teacherIds: string[]): Promise<AvailabilitySlotEntity[]> {
    if (teacherIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.slotRepo.find({
      where: { teacherId: In(teacherIds) },
      order: { dayOfWeek: 'ASC', timeFrom: 'ASC' },
    });
  }

  findSlotsByTeacherId(teacherId: string): Promise<AvailabilitySlotEntity[]> {
    return this.slotRepo.find({
      where: { teacherId },
      order: { dayOfWeek: 'ASC', timeFrom: 'ASC' },
    });
  }

  saveSlot(entity: Partial<AvailabilitySlotEntity>): Promise<AvailabilitySlotEntity> {
    return this.slotRepo.save(this.slotRepo.create(entity));
  }

  async updateSlot(
    id: string,
    data: Partial<AvailabilitySlotEntity>,
  ): Promise<AvailabilitySlotEntity | null> {
    await this.slotRepo.update({ id }, data);
    return this.findSlotById(id);
  }

  async deleteSlot(id: string): Promise<void> {
    await this.slotRepo.delete({ id });
  }

  async deleteSlotsByTeacherId(teacherId: string): Promise<void> {
    await this.slotRepo.delete({ teacherId });
  }

  async replaceSlotsForTeacher(
    teacherId: string,
    slots: Array<Pick<AvailabilitySlotEntity, 'dayOfWeek' | 'timeFrom' | 'timeTo'>>,
  ): Promise<AvailabilitySlotEntity[]> {
    return this.slotRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(AvailabilitySlotEntity);
      await repo.delete({ teacherId });
      if (slots.length === 0) {
        return [];
      }
      const rows = slots.map((slot) =>
        repo.create({
          teacherId,
          dayOfWeek: slot.dayOfWeek,
          timeFrom: slot.timeFrom,
          timeTo: slot.timeTo,
        }),
      );
      return repo.save(rows);
    });
  }

  filterSlots(
    where: FindOptionsWhere<AvailabilitySlotEntity>,
  ): Promise<AvailabilitySlotEntity[]> {
    return this.slotRepo.find({ where });
  }

  filterBookings(
    where: FindOptionsWhere<AvailabilityBookingEntity>,
  ): Promise<AvailabilityBookingEntity[]> {
    return this.bookingRepo.find({ where });
  }

  saveBooking(entity: Partial<AvailabilityBookingEntity>): Promise<AvailabilityBookingEntity> {
    return this.bookingRepo.save(this.bookingRepo.create(entity));
  }

  findLessonsByTeacherAndDate(teacherId: string, date: string): Promise<LessonEntity[]> {
    return this.lessonRepo.find({
      where: {
        teacherId,
        date,
        status: In([...SCHEDULE_OCCUPYING_LESSON_STATUSES]),
      },
    });
  }

  /**
   * Lessons on a date where any of the given students participate
   * (primary student or attendance_records).
   * Only schedule-occupying statuses are returned for conflict checks.
   */
  findLessonsForStudentsOnDate(
    studentIds: string[],
    date: string,
    excludeLessonId?: string,
  ): Promise<LessonEntity[]> {
    if (studentIds.length === 0) {
      return Promise.resolve([]);
    }

    const qb = this.lessonRepo
      .createQueryBuilder('lesson')
      .leftJoin(
        'attendance_records',
        'att',
        'att.lesson_id = lesson.id',
      )
      .where('lesson.date = :date', { date })
      .andWhere('lesson.status IN (:...occupyingStatuses)', {
        occupyingStatuses: [...SCHEDULE_OCCUPYING_LESSON_STATUSES],
      })
      .andWhere(
        '(lesson.primary_student_id IN (:...studentIds) OR att.student_id IN (:...studentIds))',
        { studentIds },
      )
      .distinct(true);

    if (excludeLessonId) {
      qb.andWhere('lesson.id != :excludeLessonId', { excludeLessonId });
    }

    return qb.getMany();
  }

  /**
   * Active bookings that still occupy the teacher slot.
   * Stale `active` rows for cancelled/missed/rescheduled lessons are ignored.
   */
  findActiveBookingsByTeacherAndDate(
    teacherId: string,
    date: string,
  ): Promise<AvailabilityBookingEntity[]> {
    return this.bookingRepo
      .createQueryBuilder('booking')
      .innerJoin(LessonEntity, 'lesson', 'lesson.id = booking.lesson_id')
      .where('booking.teacher_id = :teacherId', { teacherId })
      .andWhere('booking.date = :date', { date })
      .andWhere('booking.status = :bookingStatus', { bookingStatus: 'active' })
      .andWhere('lesson.status IN (:...occupyingStatuses)', {
        occupyingStatuses: [...SCHEDULE_OCCUPYING_LESSON_STATUSES],
      })
      .getMany();
  }

  teacherExists(teacherId: string): Promise<boolean> {
    return this.teacherRepo.exist({ where: { id: teacherId } });
  }
}
