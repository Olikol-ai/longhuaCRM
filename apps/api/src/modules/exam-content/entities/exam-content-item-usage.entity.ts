import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('exam_content_item_usage')
export class ExamContentItemUsageEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ name: 'item_id', type: 'uuid' }) itemId: string;
  @Column({ name: 'group_id', type: 'uuid', nullable: true }) groupId: string | null;
  @Column({ name: 'session_id', type: 'uuid', nullable: true }) sessionId: string | null;
  @Column({ name: 'assessment_attempt_id', type: 'uuid', nullable: true }) assessmentAttemptId: string | null;
  @CreateDateColumn({ name: 'used_at', type: 'timestamptz' }) usedAt: Date;
}
