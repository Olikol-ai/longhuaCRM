import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { LessonEntity } from './lesson.entity';
import { LessonRecurrenceSeriesEntity } from './lesson-recurrence-series.entity';

export type LessonRecurrenceExceptionReason =
  | 'rescheduled'
  | 'cancelled'
  | 'deleted'
  | 'detached';

/**
 * Marks a single series weekday date as handled so the rolling horizon
 * never recreates an occurrence for that calendar day (Google Calendar–style).
 */
@Entity('lesson_recurrence_exceptions')
@Unique('UQ_LESSON_RECURRENCE_EXCEPTION_SERIES_DATE', [
  'recurrenceSeriesId',
  'originalDate',
])
export class LessonRecurrenceExceptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_LESSON_RECURRENCE_EXCEPTION_SERIES')
  @Column({ name: 'recurrence_series_id', type: 'uuid' })
  recurrenceSeriesId: string;

  @ManyToOne(() => LessonRecurrenceSeriesEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recurrence_series_id' })
  recurrenceSeries?: LessonRecurrenceSeriesEntity;

  /** Series weekday date that must never be auto-generated again. */
  @Column({ name: 'original_date', type: 'date' })
  originalDate: string;

  @Column({ type: 'varchar', length: 32 })
  reason: LessonRecurrenceExceptionReason;

  /** Lesson that replaced / cancelled this occurrence (if still present). */
  @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
  lessonId: string | null;

  @ManyToOne(() => LessonEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lesson_id' })
  lesson?: LessonEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
