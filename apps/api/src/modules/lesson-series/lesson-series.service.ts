import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { FindOptionsWhere, Repository } from 'typeorm';
import { GroupEntity } from '../groups/entities/group.entity';
import { CreateLessonDto } from '../lessons/dto/create-lesson.dto';
import { LessonsService } from '../lessons/lessons.service';
import { ScheduleService } from '../schedule/schedule.service';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { CreateLessonSeriesDto } from './dto/create-lesson-series.dto';
import { LessonSeriesSlotDto } from './dto/lesson-series-slot.dto';
import { LessonSeriesEntity } from './entities/lesson-series.entity';
import { LessonSeriesSlotEntity } from './entities/lesson-series-slot.entity';
import { LessonSeriesRepository } from './lesson-series.repository';

type ResolvedSlot = Pick<LessonSeriesSlotDto, 'dayOfWeek' | 'startTime' | 'endTime'>;

@Injectable()
export class LessonSeriesService {
  constructor(
    private readonly repository: LessonSeriesRepository,
    private readonly lessonsService: LessonsService,
    private readonly scheduleService: ScheduleService,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(CourseTemplateEntity)
    private readonly courseRepo: Repository<CourseTemplateEntity>,
    @InjectRepository(LessonSeriesSlotEntity)
    private readonly slotRepo: Repository<LessonSeriesSlotEntity>,
  ) {}

  findAll(): Promise<LessonSeriesEntity[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<LessonSeriesEntity> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Lesson series not found');
    }
    row.slots = await this.slotRepo.find({
      where: { seriesId: id },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
    return row;
  }

  filter(where: Record<string, unknown>): Promise<LessonSeriesEntity[]> {
    return this.repository.filter(where as FindOptionsWhere<LessonSeriesEntity>);
  }

  async findByGroupId(groupId: string): Promise<LessonSeriesEntity[]> {
    const rows = await this.repository.filter({ groupId } as FindOptionsWhere<LessonSeriesEntity>);
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const slots = await this.slotRepo
      .createQueryBuilder('slot')
      .where('slot.series_id IN (:...ids)', { ids })
      .orderBy('slot.day_of_week', 'ASC')
      .addOrderBy('slot.start_time', 'ASC')
      .getMany();
    const slotsBySeries = new Map<string, LessonSeriesSlotEntity[]>();
    for (const slot of slots) {
      const list = slotsBySeries.get(slot.seriesId) ?? [];
      list.push(slot);
      slotsBySeries.set(slot.seriesId, list);
    }
    return rows.map((row) => ({
      ...row,
      slots: slotsBySeries.get(row.id) ?? [],
    }));
  }

  async create(dto: CreateLessonSeriesDto): Promise<{
    series: LessonSeriesEntity;
    lessonsCreated: number;
    skippedDates: string[];
  }> {
    const teacherId = dto.teacherId;
    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    if (group.teacherId !== teacherId) {
      throw new BadRequestException('Group does not belong to the selected teacher');
    }

    const course = await this.courseRepo.findOne({ where: { id: dto.courseId } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const useWeeklySlots = Boolean(dto.slots?.length);
    const resolvedSlots = this.resolveSlots(dto, useWeeklySlots);
    const primaryStartTime = resolvedSlots[0]?.startTime ?? dto.startTime ?? '10:00';

    const series = await this.repository.save({
      id: randomUUID(),
      courseId: dto.courseId,
      groupId: dto.groupId,
      teacherId,
      startDate: dto.startDate,
      startTime: primaryStartTime,
      frequency: dto.frequency ?? 'weekly',
      totalLessons: dto.totalLessons,
      status: dto.status ?? 'active',
      duration: dto.duration ?? 60,
      lessonFormat: dto.lessonFormat ?? 'online',
      meetingLink: dto.meetingLink ?? null,
      notes: dto.notes ?? null,
    });

    await this.slotRepo.save(
      resolvedSlots.map((slot) =>
        this.slotRepo.create({
          seriesId: series.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime ?? null,
        }),
      ),
    );

    const { lessonsCreated, skippedDates } = useWeeklySlots
      ? await this.generateFromWeeklySlots(series, resolvedSlots, teacherId)
      : await this.generateLegacyLessons(series, teacherId);

    series.slots = await this.slotRepo.find({
      where: { seriesId: series.id },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });

    return { series, lessonsCreated, skippedDates };
  }

  private resolveSlots(dto: CreateLessonSeriesDto, useWeeklySlots: boolean): ResolvedSlot[] {
    if (useWeeklySlots && dto.slots?.length) {
      return dto.slots.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }));
    }

    if (!dto.startTime) {
      throw new BadRequestException('Either slots or startTime must be provided');
    }

    return [
      {
        dayOfWeek: this.dayIndexFromDate(dto.startDate),
        startTime: dto.startTime,
      },
    ];
  }

  /** Legacy generator: every N days from first weekday on/after startDate. */
  private async generateLegacyLessons(
    series: LessonSeriesEntity,
    teacherId: string,
  ): Promise<{ lessonsCreated: number; skippedDates: string[] }> {
    const stepDays = series.frequency === 'biweekly' ? 14 : 7;
    const duration = series.duration;
    let cursor = this.parseDate(series.startDate);

    let created = 0;
    const skippedDates: string[] = [];
    let daysScanned = 0;
    const maxCalendarDays = Math.max(series.totalLessons * stepDays * 26, 366);

    const pushSkipped = (dateStr: string) => {
      if (!skippedDates.includes(dateStr)) {
        skippedDates.push(dateStr);
      }
    };

    while (created < series.totalLessons && daysScanned < maxCalendarDays) {
      daysScanned += 1;
      const dateStr = this.formatDate(cursor);

      if (this.isWeekend(cursor)) {
        pushSkipped(dateStr);
        cursor = this.addDays(cursor, 1);
        continue;
      }

      try {
        await this.scheduleService.assertAvailableForLesson(
          teacherId,
          dateStr,
          series.startTime,
          duration,
        );
        await this.scheduleService.assertNoScheduleConflicts(
          teacherId,
          dateStr,
          series.startTime,
          duration,
        );

        const lessonDto: CreateLessonDto = {
          teacherId,
          groupId: series.groupId ?? undefined,
          seriesId: series.id,
          date: dateStr,
          startTime: series.startTime,
          duration,
          lessonType: 'group',
          lessonFormat: series.lessonFormat,
          meetingLink: series.meetingLink ?? undefined,
          notes: series.notes ?? undefined,
        };
        await this.lessonsService.create(lessonDto);
        created += 1;

        cursor = this.addDays(cursor, stepDays);
        while (this.isWeekend(cursor) && daysScanned < maxCalendarDays) {
          pushSkipped(this.formatDate(cursor));
          cursor = this.addDays(cursor, 1);
          daysScanned += 1;
        }
      } catch {
        pushSkipped(dateStr);
        cursor = this.addDays(cursor, 1);
      }
    }

    return { lessonsCreated: created, skippedDates };
  }

  private async generateFromWeeklySlots(
    series: LessonSeriesEntity,
    slots: ResolvedSlot[],
    teacherId: string,
  ): Promise<{ lessonsCreated: number; skippedDates: string[] }> {
    const duration = series.duration;
    const startDate = this.parseDate(series.startDate);
    let cursor = new Date(startDate);
    let created = 0;
    const skippedDates: string[] = [];
    let daysScanned = 0;
    const maxCalendarDays = Math.max(series.totalLessons * 7 * 4, 366);
    const biweekly = series.frequency === 'biweekly';
    const startWeekIndex = this.weekIndex(cursor);

    const pushSkipped = (label: string) => {
      if (!skippedDates.includes(label)) {
        skippedDates.push(label);
      }
    };

    while (created < series.totalLessons && daysScanned < maxCalendarDays) {
      daysScanned += 1;
      const dateStr = this.formatDate(cursor);

      if (this.isWeekend(cursor)) {
        pushSkipped(dateStr);
        cursor = this.addDays(cursor, 1);
        continue;
      }

      if (biweekly && (this.weekIndex(cursor) - startWeekIndex) % 2 !== 0) {
        cursor = this.addDays(cursor, 1);
        continue;
      }

      const dayIndex = this.dayIndexFromDate(dateStr);
      const slotsForDay = slots
        .filter((slot) => slot.dayOfWeek === dayIndex)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      for (const slot of slotsForDay) {
        if (created >= series.totalLessons) {
          break;
        }
        if (cursor < startDate) {
          continue;
        }

        const slotLabel = `${dateStr} ${slot.startTime}`;
        try {
          await this.scheduleService.assertAvailableForLesson(
            teacherId,
            dateStr,
            slot.startTime,
            duration,
          );
          await this.scheduleService.assertNoScheduleConflicts(
            teacherId,
            dateStr,
            slot.startTime,
            duration,
          );

          const lessonDto: CreateLessonDto = {
            teacherId,
            groupId: series.groupId ?? undefined,
            seriesId: series.id,
            date: dateStr,
            startTime: slot.startTime,
            duration,
            lessonType: 'group',
            lessonFormat: series.lessonFormat,
            meetingLink: series.meetingLink ?? undefined,
            notes: series.notes ?? undefined,
          };
          await this.lessonsService.create(lessonDto);
          created += 1;
        } catch {
          pushSkipped(slotLabel);
        }
      }

      cursor = this.addDays(cursor, 1);
    }

    return { lessonsCreated: created, skippedDates };
  }

  private dayIndexFromDate(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekday === 0 ? 6 : weekday - 1;
  }

  private weekIndex(date: Date): number {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return Math.floor(normalized.getTime() / (7 * 24 * 60 * 60 * 1000));
  }

  private parseDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
}
