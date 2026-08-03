import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import {
  CreateRecurringLessonDto,
  LessonRecurrenceApplyScope,
  UpdateLessonRecurrenceDto,
} from './dto/lesson-recurrence.dto';
import { LessonEntity } from './entities/lesson.entity';
import {
  LessonRecurrenceSeriesEntity,
  LessonRecurrenceStatus,
} from './entities/lesson-recurrence-series.entity';
import { LessonsService } from './lessons.service';
import { UpdateLessonDto } from './dto/update-lesson.dto';

/** How many weeks ahead to keep planned occurrences. */
export const RECURRENCE_HORIZON_WEEKS = 12;

@Injectable()
export class LessonRecurrenceService {
  private readonly logger = new Logger(LessonRecurrenceService.name);

  constructor(
    @InjectRepository(LessonRecurrenceSeriesEntity)
    private readonly seriesRepo: Repository<LessonRecurrenceSeriesEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    private readonly lessonsService: LessonsService,
  ) {}

  async createWeeklySeries(
    actor: JwtPayload,
    dto: CreateRecurringLessonDto,
  ): Promise<{
    series: LessonRecurrenceSeriesEntity;
    lessonsCreated: number;
    firstLesson: LessonEntity | null;
  }> {
    const startDate = this.normalizeDate(dto.date);
    const startTime = this.normalizeTime(dto.startTime);
    const duration = dto.duration ?? 60;
    const weekday = this.weekdayFromDate(startDate);
    const untilDate = dto.untilDate ? this.normalizeDate(dto.untilDate) : null;
    if (untilDate && untilDate < startDate) {
      throw new BadRequestException('Дата окончания серии не может быть раньше первого урока');
    }

    const lessonType =
      dto.lessonType ?? (dto.groupId ? 'group' : 'individual');
    const lessonFormat = dto.lessonFormat ?? 'online';

    const series = await this.seriesRepo.save(
      this.seriesRepo.create({
        teacherId: dto.teacherId ?? null,
        tutorId: dto.tutorId ?? null,
        groupId: dto.groupId ?? null,
        primaryStudentId: dto.primaryStudentId ?? dto.studentId ?? null,
        primaryTutorStudentId: dto.primaryTutorStudentId ?? dto.tutorStudentId ?? null,
        primaryTeacherStudentContactId:
          dto.primaryTeacherStudentContactId ?? dto.teacherStudentContactId ?? null,
        weekday,
        startDate,
        startTime,
        duration,
        lessonType,
        lessonFormat,
        meetingLink: dto.meetingLink ?? null,
        room: dto.room ?? null,
        notes: dto.notes ?? null,
        status: 'active',
        untilDate,
        createdByUserId: actor.sub,
      }),
    );

    let lessonsCreated = 0;
    try {
      await this.createOccurrence(actor, series, startDate);
      lessonsCreated += 1;
    } catch (err) {
      await this.seriesRepo.delete(series.id);
      throw err;
    }
    lessonsCreated += await this.fillHorizon(actor, series, this.addDays(startDate, 7));
    const firstLesson = await this.lessonRepo.findOne({
      where: { recurrenceSeriesId: series.id, date: startDate },
      order: { startTime: 'ASC' },
    });

    return { series, lessonsCreated, firstLesson };
  }

  /**
   * Ensure each active series has planned lessons through the rolling horizon.
   */
  async extendAllActiveSeries(): Promise<{ series: number; lessonsCreated: number }> {
    const active = await this.seriesRepo.find({ where: { status: 'active' } });
    let lessonsCreated = 0;
    for (const series of active) {
      try {
        lessonsCreated += await this.fillHorizon(null, series);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to extend recurrence ${series.id}: ${message}`);
      }
    }
    return { series: active.length, lessonsCreated };
  }

  async fillHorizon(
    actor: JwtPayload | null,
    series: LessonRecurrenceSeriesEntity,
    fromDateInclusive?: string,
  ): Promise<number> {
    if (series.status !== 'active') return 0;

    const today = this.todayInMinsk();
    let startFrom = today;
    if (fromDateInclusive && fromDateInclusive > startFrom) {
      startFrom = fromDateInclusive;
    }
    if (series.startDate && series.startDate > startFrom) {
      startFrom = series.startDate;
    }
    // Horizon is measured from the series window, not only from "today",
    // so scheduling a series that starts weeks ahead still gets a full buffer.
    const horizonEnd = this.addDays(startFrom, RECURRENCE_HORIZON_WEEKS * 7);
    const hardEnd =
      series.untilDate && series.untilDate < horizonEnd ? series.untilDate : horizonEnd;
    if (startFrom > hardEnd) {
      return 0;
    }

    const existing = await this.lessonRepo.find({
      where: {
        recurrenceSeriesId: series.id,
        status: In(['planned', 'completed', 'missed', 'missed_no_notice', 'rescheduled']),
      },
      select: ['id', 'date', 'status'],
    });
    const occupiedDates = new Set(existing.map((row) => row.date));

    let cursor = this.firstWeekdayOnOrAfter(startFrom, series.weekday);
    let created = 0;

    while (cursor <= hardEnd) {
      if (!occupiedDates.has(cursor)) {
        try {
          await this.createOccurrence(actor, series, cursor);
          created += 1;
          occupiedDates.add(cursor);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Skip recurrence ${series.id} on ${cursor}: ${message}`,
          );
        }
      }
      cursor = this.addDays(cursor, 7);
    }

    return created;
  }

  private async createOccurrence(
    actor: JwtPayload | null,
    series: LessonRecurrenceSeriesEntity,
    date: string,
  ): Promise<LessonEntity> {
    const dto: CreateLessonDto = {
      teacherId: series.teacherId ?? undefined,
      tutorId: series.tutorId ?? undefined,
      groupId: series.groupId ?? undefined,
      primaryStudentId: series.primaryStudentId ?? undefined,
      primaryTutorStudentId: series.primaryTutorStudentId ?? undefined,
      primaryTeacherStudentContactId:
        series.primaryTeacherStudentContactId ?? undefined,
      date,
      startTime: series.startTime,
      duration: series.duration,
      lessonType: series.lessonType,
      lessonFormat: series.lessonFormat,
      meetingLink: series.meetingLink ?? undefined,
      room: series.room ?? undefined,
      notes: series.notes ?? undefined,
      status: 'planned',
    };

    const lesson = await this.lessonsService.create(actor, dto);
    await this.lessonRepo.update(lesson.id, {
      recurrenceSeriesId: series.id,
      isRecurring: true,
    });
    return this.lessonRepo.findOneOrFail({ where: { id: lesson.id } });
  }

  async applyLessonUpdateWithRecurrence(
    actor: JwtPayload,
    lessonId: string,
    lessonPatch: UpdateLessonDto,
    recurrence?: UpdateLessonRecurrenceDto,
  ): Promise<LessonEntity> {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const wantsWeekly = recurrence?.weekly;
    const scope: LessonRecurrenceApplyScope =
      recurrence?.applyScope ??
      (lesson.recurrenceSeriesId ? 'this' : 'this');

    // Enable weekly on a one-off lesson
    if (wantsWeekly === true && !lesson.recurrenceSeriesId) {
      const updated =
        Object.keys(lessonPatch).length > 0
          ? await this.lessonsService.update(actor, lessonId, lessonPatch)
          : lesson;
      const merged = updated;
      const series = await this.seriesRepo.save(
        this.seriesRepo.create({
          teacherId: merged.teacherId,
          tutorId: merged.tutorId,
          groupId: merged.groupId,
          primaryStudentId: merged.primaryStudentId,
          primaryTutorStudentId: merged.primaryTutorStudentId,
          primaryTeacherStudentContactId: merged.primaryTeacherStudentContactId,
          weekday: this.weekdayFromDate(merged.date),
          startDate: this.normalizeDate(merged.date),
          startTime: this.normalizeTime(merged.startTime),
          duration: merged.duration,
          lessonType: merged.lessonType,
          lessonFormat: merged.lessonFormat,
          meetingLink: merged.meetingLink,
          room: merged.room,
          notes: merged.notes,
          status: 'active',
          untilDate: recurrence?.untilDate
            ? this.normalizeDate(recurrence.untilDate)
            : null,
          createdByUserId: actor.sub,
        }),
      );
      await this.lessonRepo.update(merged.id, {
        recurrenceSeriesId: series.id,
        isRecurring: true,
      });
      await this.fillHorizon(actor, series, this.addDays(merged.date, 7));
      return this.lessonsService.findById(actor, lessonId);
    }

    // Stop recurrence
    if (wantsWeekly === false && lesson.recurrenceSeriesId) {
      await this.stopSeries(actor, lesson, scope);
      if (Object.keys(lessonPatch).length > 0) {
        return this.lessonsService.update(actor, lessonId, lessonPatch);
      }
      return this.lessonsService.findById(actor, lessonId);
    }

    // Already in series: update until / keep weekly without necessarily touching siblings
    if (lesson.recurrenceSeriesId && wantsWeekly === true) {
      const series = await this.seriesRepo.findOne({
        where: { id: lesson.recurrenceSeriesId },
      });
      if (series) {
        if (series.status !== 'active') {
          series.status = 'active';
        }
        if (recurrence?.untilDate !== undefined) {
          series.untilDate = recurrence.untilDate
            ? this.normalizeDate(recurrence.untilDate)
            : null;
        }
        await this.seriesRepo.save(series);
        if (scope === 'this' && Object.keys(lessonPatch).length === 0) {
          await this.fillHorizon(actor, series);
          return this.lessonsService.findById(actor, lessonId);
        }
      }
    }

    if (
      lesson.recurrenceSeriesId &&
      recurrence?.untilDate !== undefined &&
      scope === 'this' &&
      Object.keys(lessonPatch).length === 0 &&
      wantsWeekly === undefined
    ) {
      const series = await this.seriesRepo.findOne({
        where: { id: lesson.recurrenceSeriesId },
      });
      if (series) {
        series.untilDate = recurrence.untilDate
          ? this.normalizeDate(recurrence.untilDate)
          : null;
        await this.seriesRepo.save(series);
        await this.fillHorizon(actor, series);
        return this.lessonsService.findById(actor, lessonId);
      }
    }

    if (!lesson.recurrenceSeriesId || scope === 'this') {
      return this.lessonsService.update(actor, lessonId, lessonPatch);
    }

    const series = await this.seriesRepo.findOne({
      where: { id: lesson.recurrenceSeriesId },
    });
    if (!series) {
      return this.lessonsService.update(actor, lessonId, lessonPatch);
    }

    this.applyTemplatePatch(series, lessonPatch, recurrence);
    await this.seriesRepo.save(series);

    const datesFilter =
      scope === 'following'
        ? { fromDate: lesson.date }
        : { fromDate: null as string | null };

    const siblings = await this.lessonRepo.find({
      where: {
        recurrenceSeriesId: series.id,
        status: 'planned',
      },
      order: { date: 'ASC' },
    });

    for (const sibling of siblings) {
      if (datesFilter.fromDate && sibling.date < datesFilter.fromDate) continue;
      if (scope === 'following' && sibling.date < lesson.date) continue;
      await this.lessonsService.update(actor, sibling.id, {
        ...lessonPatch,
        // Keep each occurrence on its own date unless explicitly changing date on "this"
        date: undefined,
        startTime: lessonPatch.startTime ?? series.startTime,
        duration: lessonPatch.duration ?? series.duration,
        teacherId: lessonPatch.teacherId ?? series.teacherId ?? undefined,
        tutorId: lessonPatch.tutorId ?? series.tutorId ?? undefined,
        primaryStudentId:
          lessonPatch.primaryStudentId ?? series.primaryStudentId ?? undefined,
        primaryTutorStudentId:
          lessonPatch.primaryTutorStudentId ??
          series.primaryTutorStudentId ??
          undefined,
        primaryTeacherStudentContactId:
          lessonPatch.primaryTeacherStudentContactId ??
          series.primaryTeacherStudentContactId ??
          undefined,
        groupId: lessonPatch.groupId ?? series.groupId ?? undefined,
        lessonFormat: lessonPatch.lessonFormat ?? series.lessonFormat,
        meetingLink:
          lessonPatch.meetingLink !== undefined
            ? lessonPatch.meetingLink
            : series.meetingLink ?? undefined,
        room: lessonPatch.room !== undefined ? lessonPatch.room : series.room ?? undefined,
        notes:
          lessonPatch.notes !== undefined ? lessonPatch.notes : series.notes ?? undefined,
      });
    }

    // If date/time of "following/all" moved weekday, regenerate from anchor
    if (lessonPatch.date || lessonPatch.startTime) {
      const anchorDate = lessonPatch.date
        ? this.normalizeDate(lessonPatch.date)
        : lesson.date;
      series.weekday = this.weekdayFromDate(anchorDate);
      series.startTime = this.normalizeTime(
        lessonPatch.startTime ?? series.startTime,
      );
      await this.seriesRepo.save(series);

      if (scope === 'following' || scope === 'all') {
        if (scope === 'all') {
          series.startDate = anchorDate;
          await this.seriesRepo.save(series);
        }
        await this.regenerateFrom(actor, series, anchorDate, lessonId);
      }
    } else {
      await this.fillHorizon(actor, series);
    }

    return this.lessonsService.findById(actor, lessonId);
  }

  private async regenerateFrom(
    actor: JwtPayload,
    series: LessonRecurrenceSeriesEntity,
    fromDate: string,
    keepLessonId: string,
  ): Promise<void> {
    const future = await this.lessonRepo.find({
      where: {
        recurrenceSeriesId: series.id,
        status: 'planned',
      },
    });
    for (const row of future) {
      if (row.date < fromDate) continue;
      if (row.id === keepLessonId) {
        await this.lessonRepo.update(row.id, {
          date: fromDate,
          startTime: series.startTime,
          duration: series.duration,
          isRecurring: true,
          recurrenceSeriesId: series.id,
        });
        continue;
      }
      await this.lessonsService.delete(row.id);
    }
    await this.fillHorizon(actor, series, fromDate);
  }

  private async stopSeries(
    actor: JwtPayload,
    lesson: LessonEntity,
    scope: LessonRecurrenceApplyScope,
  ): Promise<void> {
    if (!lesson.recurrenceSeriesId) return;
    const series = await this.seriesRepo.findOne({
      where: { id: lesson.recurrenceSeriesId },
    });
    if (!series) return;

    if (scope === 'this') {
      await this.lessonRepo.update(lesson.id, {
        isRecurring: false,
        recurrenceSeriesId: null,
      });
      return;
    }

    series.status = 'stopped' as LessonRecurrenceStatus;
    await this.seriesRepo.save(series);

    const planned = await this.lessonRepo.find({
      where: { recurrenceSeriesId: series.id, status: 'planned' },
    });
    for (const row of planned) {
      if (scope === 'following' && row.date < lesson.date) continue;
      if (row.id === lesson.id) {
        await this.lessonRepo.update(row.id, {
          isRecurring: false,
          recurrenceSeriesId: null,
        });
        continue;
      }
      await this.lessonsService.delete(row.id);
    }
  }

  private applyTemplatePatch(
    series: LessonRecurrenceSeriesEntity,
    patch: UpdateLessonDto,
    recurrence?: UpdateLessonRecurrenceDto,
  ): void {
    if (patch.teacherId !== undefined) series.teacherId = patch.teacherId;
    if (patch.tutorId !== undefined) series.tutorId = patch.tutorId;
    if (patch.groupId !== undefined) series.groupId = patch.groupId ?? null;
    if (patch.primaryStudentId !== undefined) {
      series.primaryStudentId = patch.primaryStudentId ?? null;
    }
    if (patch.primaryTutorStudentId !== undefined) {
      series.primaryTutorStudentId = patch.primaryTutorStudentId ?? null;
    }
    if (patch.primaryTeacherStudentContactId !== undefined) {
      series.primaryTeacherStudentContactId =
        patch.primaryTeacherStudentContactId ?? null;
    }
    if (patch.startTime !== undefined) {
      series.startTime = this.normalizeTime(patch.startTime);
    }
    if (patch.duration !== undefined) series.duration = patch.duration;
    if (patch.lessonType !== undefined) series.lessonType = patch.lessonType;
    if (patch.lessonFormat !== undefined) series.lessonFormat = patch.lessonFormat;
    if (patch.meetingLink !== undefined) series.meetingLink = patch.meetingLink ?? null;
    if (patch.room !== undefined) series.room = patch.room ?? null;
    if (patch.notes !== undefined) series.notes = patch.notes ?? null;
    if (patch.date !== undefined) {
      series.weekday = this.weekdayFromDate(this.normalizeDate(patch.date));
    }
    if (recurrence?.untilDate !== undefined) {
      series.untilDate = recurrence.untilDate
        ? this.normalizeDate(recurrence.untilDate)
        : null;
    }
  }

  async getSeriesForLesson(lessonId: string): Promise<LessonRecurrenceSeriesEntity | null> {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson?.recurrenceSeriesId) return null;
    return this.seriesRepo.findOne({ where: { id: lesson.recurrenceSeriesId } });
  }

  weekdayFromDate(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekday === 0 ? 6 : weekday - 1;
  }

  private firstWeekdayOnOrAfter(dateStr: string, weekday: number): string {
    let cursor = dateStr;
    for (let i = 0; i < 7; i += 1) {
      if (this.weekdayFromDate(cursor) === weekday) return cursor;
      cursor = this.addDays(cursor, 1);
    }
    return dateStr;
  }

  private todayInMinsk(): string {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Minsk',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(new Date());
  }

  private normalizeDate(value: string): string {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || '').trim());
    if (!m) throw new BadRequestException('Некорректная дата');
    return m[1];
  }

  private normalizeTime(value: string): string {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim());
    if (!m) throw new BadRequestException('Некорректное время');
    return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
  }

  private addDays(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1, day));
    dt.setUTCDate(dt.getUTCDate() + days);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
