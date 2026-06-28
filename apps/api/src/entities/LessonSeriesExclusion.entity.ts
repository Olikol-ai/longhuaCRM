import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('lesson_series_exclusions')
@Index('IDX_LESSON_SERIES_EXCLUSION_SERIES_INDEX', ['seriesId', 'recurrenceIndex'], {
  unique: true,
})
export class LessonSeriesExclusionEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'series_id', type: 'uuid' })
  seriesId: string;

  @Column({ name: 'recurrence_index', type: 'int' })
  recurrenceIndex: number;

  @Column({ type: 'varchar', length: 32 })
  reason: 'deleted';

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;
}
