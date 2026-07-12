import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TeacherAvailabilitySlotEntity } from '../../entities/teacher-availability-slot.entity';
import { TeacherEntity } from '../../entities/teacher.entity';

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

@Injectable()
export class TeacherAvailabilityService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getTeacherSchedule(teacherId: string): Promise<TeacherScheduleInfo> {
    await this.assertTeacherExists(teacherId);
    const slots = await this.loadSlots(teacherId);
    return {
      hasSchedule: slots.length > 0,
      slots,
    };
  }

  async checkAvailability(
    teacherId: string,
    date: string,
    startTime: string,
    duration: number,
  ): Promise<AvailabilityCheckResult> {
    await this.assertTeacherExists(teacherId);
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
    const result = await this.checkAvailability(teacherId, date, startTime, duration);
    if (!result.available) {
      throw new BadRequestException(result.message ?? UNAVAILABLE_MESSAGE);
    }
  }

  private async assertTeacherExists(teacherId: string): Promise<void> {
    const exists = await this.dataSource.getRepository(TeacherEntity).exist({
      where: { id: teacherId },
    });
    if (!exists) {
      throw new NotFoundException('Teacher not found');
    }
  }

  private async loadSlots(teacherId: string): Promise<AvailabilitySlot[]> {
    const rows = await this.dataSource.getRepository(TeacherAvailabilitySlotEntity).find({
      where: { teacherId },
      order: { dayOfWeek: 'ASC', timeFrom: 'ASC' },
    });

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
