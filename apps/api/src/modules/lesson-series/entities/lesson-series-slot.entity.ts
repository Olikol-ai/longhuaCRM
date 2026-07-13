import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LessonSeriesEntity } from './lesson-series.entity';

/** Monday = 0 … Sunday = 6 (matches teacher availability slots). */
@Entity('lesson_series_slots')
@Index('IDX_LESSON_SERIES_SLOT_SERIES', ['seriesId'])
export class LessonSeriesSlotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lesson_series_id', type: 'uuid' })
  seriesId: string;

  @ManyToOne(() => LessonSeriesEntity, (series) => series.slots, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lesson_series_id' })
  series?: LessonSeriesEntity;

  @Column({ name: 'day_of_week', type: 'int' })
  dayOfWeek: number;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime: string | null;
}
