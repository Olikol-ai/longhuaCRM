import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('exam_content_change_log')
export class ExamContentChangeLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'entity_type', type: 'varchar', length: 32 }) entityType: string;
  @Column({ name: 'entity_id', type: 'uuid' }) entityId: string;
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true }) actorUserId: string | null;
  @Column({ type: 'varchar', length: 64 }) action: string;
  @Column({ type: 'text', nullable: true }) summary: string | null;
  @Column({ name: 'before_revision', type: 'int', nullable: true }) beforeRevision: number | null;
  @Column({ name: 'after_revision', type: 'int', nullable: true }) afterRevision: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
