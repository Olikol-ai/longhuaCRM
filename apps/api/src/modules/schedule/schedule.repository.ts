import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, Repository } from 'typeorm';
import { LessonEntity } from '../lessons/entities/lesson.entity';
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
        status: Not('cancelled' as LessonEntity['status']),
      },
    });
  }

  findActiveBookingsByTeacherAndDate(
    teacherId: string,
    date: string,
  ): Promise<AvailabilityBookingEntity[]> {
    return this.bookingRepo.find({
      where: {
        teacherId,
        date,
        status: 'active',
      },
    });
  }

  teacherExists(teacherId: string): Promise<boolean> {
    return this.teacherRepo.exist({ where: { id: teacherId } });
  }
}
