import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('exam_content_item_stats')
export class ExamContentItemStatsEntity {
  @PrimaryColumn({ name: 'item_id', type: 'uuid' }) itemId: string;
  @Column({ name: 'times_used', type: 'int', default: 0 }) timesUsed: number;
  @Column({ name: 'times_answered', type: 'int', default: 0 }) timesAnswered: number;
  @Column({ name: 'times_correct', type: 'int', default: 0 }) timesCorrect: number;
  @Column({ name: 'times_wrong', type: 'int', default: 0 }) timesWrong: number;
  @Column({ name: 'avg_answer_time_ms', type: 'int', nullable: true }) avgAnswerTimeMs: number | null;
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true }) lastUsedAt: Date | null;
  @Column({ name: 'difficulty_index', type: 'numeric', precision: 8, scale: 4, nullable: true }) difficultyIndex: string | null;
  @Column({ name: 'discrimination_index', type: 'numeric', precision: 8, scale: 4, nullable: true }) discriminationIndex: string | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
