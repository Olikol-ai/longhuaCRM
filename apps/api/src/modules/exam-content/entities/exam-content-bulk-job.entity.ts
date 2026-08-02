import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('exam_content_bulk_jobs')
export class ExamContentBulkJobEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 32, default: 'pending' }) status: string;
  @Column({ type: 'varchar', length: 64 }) action: string;
  @Column({ name: 'payload_summary', type: 'text', nullable: true }) payloadSummary: string | null;
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true }) createdByUserId: string | null;
  @Column({ name: 'affected_count', type: 'int', default: 0 }) affectedCount: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true }) finishedAt: Date | null;
}
