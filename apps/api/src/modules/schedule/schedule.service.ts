import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, FindOptionsWhere } from 'typeorm';
import { ScheduleAccessService } from '../../common/access/schedule-access.service';
import { normalizeRole } from '../../common/constants/roles';
import { JwtPayload } from '../auth/auth.service';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { AvailabilityBookingEntity } from './entities/availability-booking.entity';
import { AvailabilitySlotEntity } from './entities/availability-slot.entity';
import { AvailabilitySlotItemDto } from './dto/replace-availability-slots.dto';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-availability-slot.dto';
import { ScheduleRepository } from './schedule.repository';
import {
  ClockInterval,
  computeFreeClockIntervals,
  clockToMinutes,
} from './teacher-free-schedule.util';

export type AvailabilitySlot = {
  day: number;
  from: string;
  to: string;
};

export type TeacherScheduleInfo = {
  hasSchedule: boolean;
  slots: AvailabilitySlot[];
};

export type LessonConflictInfo = {
  lessonId: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  lessonType: string;
  participantLabel: string;
  summary: string;
};

export type AvailabilityCheckResult = {
  available: boolean;
  hasSchedule: boolean;
  message?: string;
  slotsForDay: AvailabilitySlot[];
  /** True when an occupying lesson overlaps the requested slot. */
  occupied: boolean;
  /**
   * free — no lesson conflict and within declared schedule (or no schedule set)
   * busy — lesson conflict
   * outside_availability — no lesson conflict but outside declared weekly slots
   */
  status: 'free' | 'busy' | 'outside_availability';
  conflict: LessonConflictInfo | null;
};

export type TeacherFreeDay = {
  date: string;
  weekday: number;
  availability: ClockInterval[];
  busy: ClockInterval[];
  free: ClockInterval[];
};

export type TeacherFreeScheduleRow = {
  teacherId: string;
  teacherName: string;
  hasSchedule: boolean;
  days: TeacherFreeDay[];
};

export type FreeScheduleResult = {
  from: string;
  to: string;
  teachers: TeacherFreeScheduleRow[];
};

/** Options for hard availability gating on lesson assignment. */
export type AssertAvailabilityOptions = {
  /**
   * When false, declared teacher availability is advisory only
   * (admin may assign outside the preferred schedule).
   * Default: true.
   */
  enforce?: boolean;
};

const UNAVAILABLE_MESSAGE =
  'Преподаватель в это время не работает. Урок не может быть назначен.';

const CONFLICT_MESSAGE =
  'У преподавателя уже есть урок в это время.';

const STUDENT_CONFLICT_MESSAGE =
  'У ученика уже есть другое занятие в это время.';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FREE_SCHEDULE_DAYS = 31;

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
    excludeLessonId?: string,
  ): Promise<AvailabilityCheckResult> {
    await this.scheduleAccess.assertCanAccessTeacherSchedule(actor, teacherId);
    await this.assertTeacherExists(teacherId);
    return this.evaluateAvailability(
      teacherId,
      date,
      startTime,
      duration,
      excludeLessonId,
    );
  }

  /**
   * Free intervals for teachers over a date range:
   * free = declared weekly availability − occupying lessons (planned/completed).
   * Recurring instances are already materialised as lesson rows by fillHorizon.
   */
  async getFreeSchedule(
    actor: JwtPayload,
    fromDate: string,
    toDate: string,
    teacherId?: string,
  ): Promise<FreeScheduleResult> {
    this.assertDateRange(fromDate, toDate);

    const role = normalizeRole(actor.role);
    if (teacherId) {
      await this.scheduleAccess.assertCanAccessTeacherSchedule(actor, teacherId);
    } else if (role !== 'admin') {
      // Non-admins must pass their own teacherId (ACL enforced above).
      throw new BadRequestException('teacherId is required');
    }

    const teachers = teacherId
      ? [await this.repository.findTeacherById(teacherId)].filter(
          (row): row is NonNullable<typeof row> => Boolean(row),
        )
      : await this.repository.findActiveTeachers();

    if (teacherId && teachers.length === 0) {
      throw new NotFoundException('Teacher not found');
    }

    const teacherIds = teachers.map((t) => t.id);
    const slotsByTeacher = await this.loadSlotsForTeachers(teacherIds);
    const lessons = await this.repository.findOccupyingLessonsForTeachersInRange(
      teacherIds,
      fromDate,
      toDate,
    );
    const lessonsByTeacherDate = new Map<string, LessonEntity[]>();
    for (const lesson of lessons) {
      if (!lesson.teacherId) continue;
      const key = `${lesson.teacherId}|${lesson.date}`;
      const list = lessonsByTeacherDate.get(key) ?? [];
      list.push(lesson);
      lessonsByTeacherDate.set(key, list);
    }

    const dates = this.enumerateDatesInclusive(fromDate, toDate);
    const rows: TeacherFreeScheduleRow[] = teachers.map((teacher) => {
      const slots = slotsByTeacher.get(teacher.id) ?? [];
      const hasSchedule = slots.length > 0;
      const days: TeacherFreeDay[] = dates.map((date) => {
        const weekday = this.dayIndexFromDate(date);
        const availability: ClockInterval[] = hasSchedule
          ? slots
              .filter((slot) => slot.day === weekday)
              .map((slot) => ({
                from: this.formatTimeValue(slot.from),
                to: this.formatTimeValue(slot.to),
              }))
          : [];
        const dayLessons = lessonsByTeacherDate.get(`${teacher.id}|${date}`) ?? [];
        const busy: ClockInterval[] = dayLessons.map((lesson) => {
          const from = this.formatTimeValue(lesson.startTime);
          const to = this.formatTimeValue(
            this.addMinutesToTime(lesson.startTime, lesson.duration || 60),
          );
          return { from, to };
        });
        const free = hasSchedule
          ? computeFreeClockIntervals(availability, busy)
          : [];
        return { date, weekday, availability, busy, free };
      });
      return {
        teacherId: teacher.id,
        teacherName: teacher.name,
        hasSchedule,
        days,
      };
    });

    return { from: fromDate, to: toDate, teachers: rows };
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
    excludeLessonId?: string,
  ): Promise<AvailabilityCheckResult> {
    const slots = await this.loadSlots(teacherId);
    const hasSchedule = slots.length > 0;
    const dayOfWeek = this.dayIndexFromDate(date);
    const slotsForDay = slots.filter((slot) => slot.day === dayOfWeek);

    const timeFrom = this.normalizeTime(startTime);
    const timeTo = this.addMinutesToTime(timeFrom, Number(duration) || 60);

    const conflict = await this.findLessonConflict(
      teacherId,
      date,
      timeFrom,
      timeTo,
      excludeLessonId,
    );

    let withinDeclared = true;
    let message: string | undefined;
    if (hasSchedule) {
      if (slotsForDay.length === 0) {
        withinDeclared = false;
        message = UNAVAILABLE_MESSAGE;
      } else {
        withinDeclared = slotsForDay.some((slot) =>
          this.rangeContained(
            timeFrom,
            timeTo,
            this.normalizeTime(slot.from),
            this.normalizeTime(slot.to),
          ),
        );
        if (!withinDeclared) {
          message = UNAVAILABLE_MESSAGE;
        }
      }
    }

    if (conflict) {
      return {
        available: withinDeclared,
        hasSchedule,
        message: CONFLICT_MESSAGE,
        slotsForDay,
        occupied: true,
        status: 'busy',
        conflict,
      };
    }

    if (!withinDeclared) {
      return {
        available: false,
        hasSchedule,
        message,
        slotsForDay,
        occupied: false,
        status: 'outside_availability',
        conflict: null,
      };
    }

    return {
      available: true,
      hasSchedule,
      slotsForDay,
      occupied: false,
      status: 'free',
      conflict: null,
    };
  }

  private async findLessonConflict(
    teacherId: string,
    date: string,
    timeFrom: string,
    timeTo: string,
    excludeLessonId?: string,
  ): Promise<LessonConflictInfo | null> {
    const lessons = await this.repository.findOccupyingLessonsByTeacherAndDate(
      teacherId,
      date,
    );
    for (const lesson of lessons) {
      if (excludeLessonId && lesson.id === excludeLessonId) {
        continue;
      }
      const lessonFrom = this.normalizeTime(lesson.startTime);
      const lessonTo = this.addMinutesToTime(lessonFrom, lesson.duration || 60);
      if (!this.rangesOverlap(timeFrom, timeTo, lessonFrom, lessonTo)) {
        continue;
      }
      return this.toConflictInfo(lesson, lessonFrom, lessonTo);
    }

    // Bookings are a slot-lock mirror of occupying lessons. After the repository
    // requires lesson.date/teacher_id to match the booking, every hit has a
    // same-day lesson — report that lesson, never a misleading "бронирование".
    const bookings = await this.repository.findActiveBookingsByTeacherAndDate(
      teacherId,
      date,
    );
    for (const booking of bookings) {
      if (excludeLessonId && booking.lessonId === excludeLessonId) {
        continue;
      }
      const bookingFrom = this.normalizeTime(booking.timeFrom);
      const bookingTo = this.normalizeTime(booking.timeTo);
      if (!this.rangesOverlap(timeFrom, timeTo, bookingFrom, bookingTo)) {
        continue;
      }
      const linked = lessons.find((row) => row.id === booking.lessonId);
      if (linked) {
        return this.toConflictInfo(linked, bookingFrom, bookingTo);
      }
      // Defensive: same-day occupying lesson must exist after the join filter.
      // Skip rather than invent a fake "booking" conflict.
    }

    return null;
  }

  private toConflictInfo(
    lesson: LessonEntity,
    lessonFrom: string,
    lessonTo: string,
  ): LessonConflictInfo {
    const startTime = this.formatTimeValue(lessonFrom);
    const endTime = this.formatTimeValue(lessonTo);
    const lessonType = lesson.lessonType || 'individual';
    const typeLabel =
      lessonType === 'group'
        ? 'групповой'
        : lessonType === 'trial'
          ? 'пробное'
          : 'индивидуальный';
    const participantLabel = this.resolveParticipantLabel(lesson);
    const summary = `Занят: ${typeLabel}${
      participantLabel ? `, ${participantLabel}` : ''
    }, ${startTime}–${endTime}`;
    return {
      lessonId: lesson.id,
      date: lesson.date,
      startTime,
      endTime,
      duration: lesson.duration || 60,
      lessonType,
      participantLabel,
      summary,
    };
  }

  private resolveParticipantLabel(lesson: LessonEntity): string {
    if (lesson.group?.name) {
      return `группа ${lesson.group.name}`;
    }
    if (lesson.primaryStudent?.name) {
      return `ученик ${lesson.primaryStudent.name}`;
    }
    if (lesson.primaryTeacherStudentContact?.name) {
      return `ученик ${lesson.primaryTeacherStudentContact.name}`;
    }
    if (lesson.primaryTutorStudent?.name) {
      return `ученик ${lesson.primaryTutorStudent.name}`;
    }
    if (lesson.lessonType === 'trial') {
      return 'пробное занятие';
    }
    return '';
  }

  private assertDateRange(fromDate: string, toDate: string): void {
    if (!ISO_DATE_RE.test(fromDate) || !ISO_DATE_RE.test(toDate)) {
      throw new BadRequestException('from and to must be YYYY-MM-DD');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('from must be on or before to');
    }
    const days = this.enumerateDatesInclusive(fromDate, toDate);
    if (days.length > MAX_FREE_SCHEDULE_DAYS) {
      throw new BadRequestException(
        `Период не может превышать ${MAX_FREE_SCHEDULE_DAYS} дней`,
      );
    }
  }

  private enumerateDatesInclusive(fromDate: string, toDate: string): string[] {
    const dates: string[] = [];
    let cursor = fromDate;
    while (cursor <= toDate) {
      dates.push(cursor);
      cursor = this.addCalendarDays(cursor, 1);
    }
    return dates;
  }

  private addCalendarDays(isoDate: string, days: number): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1, day));
    dt.setUTCDate(dt.getUTCDate() + days);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async assertAvailableForLesson(
    teacherId: string,
    date: string,
    startTime: string,
    duration: number,
    options?: AssertAvailabilityOptions,
  ): Promise<void> {
    // Admin assignment: preferred schedule is advisory, not a hard block.
    // Real lesson/booking overlaps stay enforced via assertNoScheduleConflicts.
    if (options?.enforce === false) {
      return;
    }
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

  
  async assertNoTutorStudentScheduleConflicts(
    tutorStudentIds: string[],
    date: string,
    startTime: string,
    duration: number,
    excludeLessonId?: string,
  ): Promise<void> {
    const uniqueIds = [...new Set(tutorStudentIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return;
    }

    const timeFrom = this.normalizeTime(startTime);
    const timeTo = this.addMinutesToTime(timeFrom, Number(duration) || 60);
    const lessons = await this.repository.findLessonsForTutorStudentsOnDate(
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

  /**
   * Align or cancel the availability booking after create / reschedule / cancel.
   * Prefer calling inside the same transaction as the lesson write (`manager`).
   */
  async syncLessonAvailabilityBooking(
    params: {
      lessonId: string;
      teacherId: string | null | undefined;
      date: string;
      startTime: string;
      duration: number;
      occupying: boolean;
    },
    manager?: EntityManager,
  ): Promise<void> {
    const timeFrom = this.normalizeTime(params.startTime);
    const timeTo = this.addMinutesToTime(timeFrom, Number(params.duration) || 60);
    const bookingRepo = manager
      ? manager.getRepository(AvailabilityBookingEntity)
      : undefined;
    await this.repository.syncBookingForLesson(
      {
        lessonId: params.lessonId,
        teacherId: params.teacherId,
        date: params.date,
        timeFrom,
        timeTo,
        occupying: params.occupying,
      },
      bookingRepo,
    );
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
