import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('exam_academy_user_stats_daily')
@Index('UQ_EA_STATS_DAILY', ['userId', 'day', 'programVersionId', 'levelId'], { unique: true })
export class ExamAcademyUserStatsDailyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'date' })
  day: string;

  @Column({ name: 'program_version_id', type: 'uuid', nullable: true })
  programVersionId: string | null;

  @Column({ name: 'level_id', type: 'uuid', nullable: true })
  levelId: string | null;

  @Column({ name: 'practice_count', type: 'int', default: 0 })
  practiceCount: number;

  @Column({ name: 'mock_count', type: 'int', default: 0 })
  mockCount: number;

  @Column({ name: 'avg_percent', type: 'numeric', precision: 6, scale: 2, default: 0 })
  avgPercent: string;

  @Column({ name: 'best_percent', type: 'numeric', precision: 6, scale: 2, default: 0 })
  bestPercent: string;

  @Column({ name: 'total_duration_seconds', type: 'int', default: 0 })
  totalDurationSeconds: number;

  @Column({ name: 'error_count', type: 'int', default: 0 })
  errorCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
