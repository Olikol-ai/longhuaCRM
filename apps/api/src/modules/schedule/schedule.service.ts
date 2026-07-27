import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { ScheduleAccessService } from '../../common/access/schedule-access.service';
import { JwtPayload } from '../auth/auth.service';
import { AvailabilityBookingEntity } from './entities/availability-booking.entity';
import { AvailabilitySlotEntity } from './entities/availability-slot.entity';
import { AvailabilitySlotItemDto } from './dto/replace-availability-slots.dto';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-availability-slot.dto';
import { ScheduleRepository } from './schedule.repository';

export type AvailabilitySlot = {
  day: number;
  from: string;
  to: string;
};

export type TeacherScheduleInfo = {
  hasSchedule: boolean;
  slots: AvailabilitySlot[];
};

export type AvailabilityCheckResult = {
  available: boolean;
  hasSchedule: boolean;
  message?: string;
  slotsForDay: AvailabilitySlot[];
};

const UNAVAILABLE_MESSAGE =
  'Преподаватель в это время не работает. Урок не может быть назначен.';

const CONFLICT_MESSAGE =
  'У преподавателя уже есть урок или бронирование в это время.';

const STUDENT_CONFLICT_MESSAGE =
  'У ученика уже есть другое занятие в это время.';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly scheduleAccess: ScheduleAccessService,
  ) {}

  async findAllSlots(actor: JwtPayload): Promise<AvailabilitySlotEntity[]> {
    const where = await this.scheduleAccess.scopeSlotFilter(actor, {});
    return this.repository.filterSlots(where as FindOptionsWhere<AvailabilitySlotEntity>);
  }

  async findSlotById(actor: JwtPayload, id: string): Promise<AvailabilitySlotEntity> {
    const row = await this.repository.findSlotById(id);
    if (!row) {
      throw new NotFoundException('Availability slot not found');
    }
    await this.scheduleAccess.assertCanReadSlot(actor, row.teacherId);
    return row;
  }

  async createSlot(
    actor: JwtPayload,
    dto: CreateAvailabilitySlotDto,
  ): Promise<AvailabilitySlotEntity> {
    await this.scheduleAccess.assertCanWriteTeacherSchedule(actor, dto.teacherId);
    this.assertValidTimeRange(dto.timeFrom, dto.timeTo);
    return this.repository.saveSlot({
      teacherId: dto.teacherId,
      dayOfWeek: dto.dayOfWeek,
      timeFrom: this.normalizeTime(dto.timeFrom),
      timeTo: this.normalizeTime(dto.timeTo),
    });
  }

  async updateSlot(
    actor: JwtPayload,
    id: string,
    dto: UpdateAvailabilitySlotDto,
  ): Promise<AvailabilitySlotEntity> {
    const existing = await this.repository.findSlotById(id);
    if (!existing) {
      throw new NotFoundException('Availability slot not found');
    }
    await this.scheduleAccess.assertCanWriteTeacherSchedule(actor, existing.teacherId);

    const timeFrom = dto.timeFrom ?? existing.timeFrom;
    const timeTo = dto.timeTo ?? existing.timeTo;
    this.assertValidTimeRange(timeFrom, timeTo);

    const row = await this.repository.updateSlot(id, {
      dayOfWeek: dto.dayOfWeek,
      timeFrom: dto.timeFrom ? this.normalizeTime(dto.timeFrom) : undefined,
      timeTo: dto.timeTo ? this.normalizeTime(dto.timeTo) : undefined,
    });
    if (!row) {
      throw new NotFoundException('Availability slot not found');
    }
    return row;
  }

  async deleteSlot(actor: JwtPayload, id: string): Promise<void> {
    const existing = await this.repository.findSlotById(id);
    if (!existing) {
      throw new NotFoundException('Availability slot not found');
    }
    await this.scheduleAccess.assertCanWriteTeacherSchedule(actor, existing.teacherId);
    await this.repository.deleteSlot(id);
  }

  async replaceTeacherAvailability(
    actor: JwtPayload,
    teacherId: string,
    slots: AvailabilitySlotItemDto[],
  ): Promise<TeacherScheduleInfo> {
    await this.scheduleAccess.assertCanWriteTeacherSchedule(actor, teacherId);
    await this.assertTeacherExists(teacherId);

    const normalized = (slots ?? []).map((slot) => {
      this.assertValidTimeRange(slot.from, slot.to);
      return {
        dayOfWeek: slot.day,
        timeFrom: this.normalizeTime(slot.from),
        timeTo: this.normalizeTime(slot.to),
      };
    });

    await this.repository.replaceSlotsForTeacher(teacherId, normalized);
    return this.getTeacherSchedule(actor, teacherId);
  }

  async filterSlots(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<AvailabilitySlotEntity[]> {
    const scoped = await this.scheduleAccess.scopeSlotFilter(actor, where);
    return this.repository.filterSlots(scoped as FindOptionsWhere<AvailabilitySlotEntity>);
  }

  async filterBookings(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<AvailabilityBookingEntity[]> {
    const scoped = await this.scheduleAccess.scopeBookingFilter(actor, where);
    return this.repository.filterBookings(scoped as FindOptionsWhere<AvailabilityBookingEntity>);
  }

  async getTeacherSchedule(actor: JwtPayload, teacherId: string): Promise<TeacherScheduleInfo> {
    await this.scheduleAccess.assertCanAccessTeacherSchedule(actor, teacherId);
    await this.assertTeacherExists(teacherId);
    const slots = await this.loadSlots(teacherId);
    return {
      hasSchedule: slots.length > 0,
      slots,
    };
  }

  async checkAvailability(
    actor: JwtPayload,
    teacherId: string,
    date: string,
    startTime: string,
    duration: number,
  ): Promise<AvailabilityCheckResult> {
    await this.scheduleAccess.assertCanAccessTeacherSchedule(actor, teacherId);
    await this.assertTeacherExists(teacherId);
    return this.evaluateAvailability(teacherId, date, startTime, duration);
  }

  /** Same rules as lesson creation — for advisory available-teachers list. */
  isTeacherFreeForSlot(
    slots: AvailabilitySlot[],
    date: string,
    startTime: string,
    duration: number,
  ): boolean {
    if (slots.length === 0) {
      return true;
    }
    const dayOfWeek = this.dayIndexFromDate(date);
    const slotsForDay = slots.filter((slot) => slot.day === dayOfWeek);
    if (slotsForDay.length === 0) {
      return false;
    }
    const timeFrom = this.normalizeTime(startTime);
    const timeTo = this.addMinutesToTime(timeFrom, Number(duration) || 60);
    return slotsForDay.some((slot) =>
      this.rangeContained(
        timeFrom,
        timeTo,
        this.normalizeTime(slot.from),
        this.normalizeTime(slot.to),
      ),
    );
  }

  async loadSlotsForTeacher(teacherId: string): Promise<AvailabilitySlot[]> {
    return this.loadSlots(teacherId);
  }

  async loadSlotsForTeachers(
    teacherIds: string[],
  ): Promise<Map<string, AvailabilitySlot[]>> {
    const rows = await this.repository.findSlotsByTeacherIds(teacherIds);
    const map = new Map<string, AvailabilitySlot[]>();
    for (const id of teacherIds) {
      map.set(id, []);
    }
    for (const row of rows) {
      const list = map.get(row.teacherId) ?? [];
      list.push({
        day: row.dayOfWeek,
        from: this.formatTimeValue(row.timeFrom),
        to: this.formatTimeValue(row.timeTo),
      });
      map.set(row.teacherId, list);
    }
    return map;
  }

  private async evaluateAvailability(
    teacherId: string,
    date: string,
    startTime: string,
    duration: number,
  ): Promise<AvailabilityCheckResult> {
    const slots = await this.loadSlots(teacherId);

    if (slots.length === 0) {
      return {
        available: true,
        hasSchedule: false,
        slotsForDay: [],
      };
    }

    const dayOfWeek = this.dayIndexFromDate(date);
    const slotsForDay = slots.filter((slot) => slot.day === dayOfWeek);

    if (slotsForDay.length === 0) {
      return {
        available: false,
        hasSchedule: true,
        message: UNAVAILABLE_MESSAGE,
        slotsForDay: [],
      };
    }

    const timeFrom = this.normalizeTime(startTime);
    const timeTo = this.addMinutesToTime(timeFrom, Number(duration) || 60);
    const fitsSlot = slotsForDay.some((slot) =>
      this.rangeContained(
        timeFrom,
        timeTo,
        this.normalizeTime(slot.from),
        this.normalizeTime(slot.to),
      ),
    );

    if (!fitsSlot) {
      return {
        available: false,
        hasSchedule: true,
        message: UNAVAILABLE_MESSAGE,
        slotsForDay,
      };
    }

    return {
      available: true,
      hasSchedule: true,
      slotsForDay,
    };
  }

  async assertAvailableForLesson(
    teacherId: string,
    date: string,
    startTime: string,
    duration: number,
  ): Promise<void> {
    const result = await this.evaluateAvailability(teacherId, date, startTime, duration);
    if (!result.available) {
      throw new BadRequestException(result.message ?? UNAVAILABLE_MESSAGE);
    }
  }

  async assertNoScheduleConflicts(
    teacherId: string,
    date: string,
    startTime: string,
    duration: number,
    excludeLessonId?: string,
  ): Promise<void> {
    const timeFrom = this.normalizeTime(startTime);
    const timeTo = this.addMinutesToTime(timeFrom, Number(duration) || 60);

    const lessons = await this.repository.findLessonsByTeacherAndDate(teacherId, date);
    for (const lesson of lessons) {
      if (excludeLessonId && lesson.id === excludeLessonId) {
        continue;
      }
      const lessonFrom = this.normalizeTime(lesson.startTime);
      const lessonTo = this.addMinutesToTime(lessonFrom, lesson.duration || 60);
      if (this.rangesOverlap(timeFrom, timeTo, lessonFrom, lessonTo)) {
        throw new BadRequestException(CONFLICT_MESSAGE);
      }
    }

    const bookings = await this.repository.findActiveBookingsByTeacherAndDate(teacherId, date);
    for (const booking of bookings) {
      if (excludeLessonId && booking.lessonId === excludeLessonId) {
        continue;
      }
      const bookingFrom = this.normalizeTime(booking.timeFrom);
      const bookingTo = this.normalizeTime(booking.timeTo);
      if (this.rangesOverlap(timeFrom, timeTo, bookingFrom, bookingTo)) {
        throw new BadRequestException(CONFLICT_MESSAGE);
      }
    }
  }

  /**
   * Tutor lessons do not use school availability slots / bookings —
   * only overlapping tutor-owned lessons are blocked.
   */
  async assertNoTutorScheduleConflicts(
    tutorId: string,
    date: string,
    startTime: string,
    duration: number,
    excludeLessonId?: string,
  ): Promise<void> {
    const timeFrom = this.normalizeTime(startTime);
    const timeTo = this.addMinutesToTime(timeFrom, Number(duration) || 60);

    const lessons = await this.repository.findLessonsByTutorAndDate(tutorId, date);
    for (const lesson of lessons) {
      if (excludeLessonId && lesson.id === excludeLessonId) {
        continue;
      }
      const lessonFrom = this.normalizeTime(lesson.startTime);
      const lessonTo = this.addMinutesToTime(lessonFrom, lesson.duration || 60);
      if (this.rangesOverlap(timeFrom, timeTo, lessonFrom, lessonTo)) {
        throw new BadRequestException(CONFLICT_MESSAGE);
      }
    }
  }

  /**
   * Ensures none of the given students already have a lesson overlapping the slot.
   */
  async assertNoStudentScheduleConflicts(
    studentIds: string[],
    date: string,
    startTime: string,
    duration: number,
    excludeLessonId?: string,
  ): Promise<void> {
    const uniqueIds = [...new Set(studentIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return;
    }

    const timeFrom = this.normalizeTime(startTime);
    const timeTo = this.addMinutesToTime(timeFrom, Number(duration) || 60);
    const lessons = await this.repository.findLessonsForStudentsOnDate(
      uniqueIds,
      date,
      excludeLessonId,
    );

    for (const lesson of lessons) {
      const lessonFrom = this.normalizeTime(lesson.startTime);
      const lessonTo = this.addMinutesToTime(lessonFrom, lesson.duration || 60);
      if (this.rangesOverlap(timeFrom, timeTo, lessonFrom, lessonTo)) {
        throw new BadRequestException(STUDENT_CONFLICT_MESSAGE);
      }
    }
  }

  async createLessonBooking(params: {
    teacherId: string;
    lessonId: string;
    date: string;
    startTime: string;
    duration: number;
  }): Promise<AvailabilityBookingEntity> {
    const timeFrom = this.normalizeTime(params.startTime);
    const timeTo = this.addMinutesToTime(timeFrom, Number(params.duration) || 60);
    return this.repository.saveBooking({
      teacherId: params.teacherId,
      lessonId: params.lessonId,
      date: params.date,
      timeFrom,
      timeTo,
      status: 'active',
    });
  }

  private assertValidTimeRange(timeFrom: string, timeTo: string): void {
    const from = this.parseTimeToMinutes(timeFrom);
    const to = this.parseTimeToMinutes(timeTo);
    if (from >= to) {
      throw new BadRequestException('timeFrom must be earlier than timeTo');
    }
  }

  private async assertTeacherExists(teacherId: string): Promise<void> {
    const exists = await this.repository.teacherExists(teacherId);
    if (!exists) {
      throw new NotFoundException('Teacher not found');
    }
  }

  private async loadSlots(teacherId: string): Promise<AvailabilitySlot[]> {
    const rows = await this.repository.findSlotsByTeacherId(teacherId);
    return rows.map((row) => ({
      day: row.dayOfWeek,
      from: this.formatTimeValue(row.timeFrom),
      to: this.formatTimeValue(row.timeTo),
    }));
  }

  private formatTimeValue(value: string): string {
    const normalized = this.normalizeTime(value);
    return normalized.slice(0, 5);
  }

  dayIndexFromDate(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekday === 0 ? 6 : weekday - 1;
  }

  parseTimeToMinutes(time: string): number {
    const normalized = this.normalizeTime(time);
    const [hours, minutes] = normalized.split(':').map(Number);
    return hours * 60 + minutes;
  }

  normalizeTime(time: string): string {
    const parts = String(time ?? '00:00').split(':');
    const hours = String(Number(parts[0] ?? 0)).padStart(2, '0');
    const minutes = String(Number(parts[1] ?? 0)).padStart(2, '0');
    return `${hours}:${minutes}:00`;
  }

  addMinutesToTime(time: string, minutes: number): string {
    const total = this.parseTimeToMinutes(time) + minutes;
    const hours = Math.floor(total / 60) % 24;
    const mins = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
  }

  rangesOverlap(fromA: string, toA: string, fromB: string, toB: string): boolean {
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
