import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { LessonSeriesEntity } from '../../lesson-series/entities/lesson-series.entity';

export type SeriesExclusionReason = 'deleted';

@Entity('lesson_series_exclusions')
@Index('IDX_SERIES_EXCLUSION_SERIES_INDEX', ['seriesId', 'recurrenceIndex'], {
  unique: true,
})
export class SeriesExclusionEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'series_id', type: 'uuid' })
  seriesId: string;

  @ManyToOne(() => LessonSeriesEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'series_id' })
  series?: LessonSeriesEntity;

  @Column({ name: 'recurrence_index', type: 'int' })
  recurrenceIndex: number;

  @Column({ type: 'varchar', length: 32, default: 'deleted' })
  reason: SeriesExclusionReason;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
