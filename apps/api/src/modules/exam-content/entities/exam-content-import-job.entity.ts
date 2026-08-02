import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('exam_content_import_jobs')
export class ExamContentImportJobEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 32, default: 'pending' }) status: string;
  @Column({ type: 'varchar', length: 16 }) format: string;
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true }) createdByUserId: string | null;
  @Column({ name: 'total_rows', type: 'int', default: 0 }) totalRows: number;
  @Column({ name: 'success_rows', type: 'int', default: 0 }) successRows: number;
  @Column({ name: 'error_rows', type: 'int', default: 0 }) errorRows: number;
  @Column({ name: 'error_summary', type: 'text', nullable: true }) errorSummary: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true }) finishedAt: Date | null;
}
