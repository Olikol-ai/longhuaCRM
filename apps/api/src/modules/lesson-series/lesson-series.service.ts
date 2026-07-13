import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FindOptionsWhere } from 'typeorm';
import { GroupEntity } from '../groups/entities/group.entity';
import { CreateLessonDto } from '../lessons/dto/create-lesson.dto';
import { LessonsService } from '../lessons/lessons.service';
import { ScheduleService } from '../schedule/schedule.service';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { LessonSeriesEntity } from './entities/lesson-series.entity';
import { CreateLessonSeriesDto } from './dto/create-lesson-series.dto';
import { LessonSeriesRepository } from './lesson-series.repository';

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
  ) {}

  findAll(): Promise<LessonSeriesEntity[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<LessonSeriesEntity> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Lesson series not found');
    }
    return row;
  }

  filter(where: Record<string, unknown>): Promise<LessonSeriesEntity[]> {
    return this.repository.filter(where as FindOptionsWhere<LessonSeriesEntity>);
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

    const series = await this.repository.save({
      id: randomUUID(),
      courseId: dto.courseId,
      groupId: dto.groupId,
      teacherId,
      startDate: dto.startDate,
      startTime: dto.startTime,
      frequency: dto.frequency ?? 'weekly',
      totalLessons: dto.totalLessons,
      status: dto.status ?? 'active',
      duration: dto.duration ?? 60,
      lessonFormat: dto.lessonFormat ?? 'online',
      meetingLink: dto.meetingLink ?? null,
      notes: dto.notes ?? null,
    });

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

    return { series, lessonsCreated: created, skippedDates };
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
