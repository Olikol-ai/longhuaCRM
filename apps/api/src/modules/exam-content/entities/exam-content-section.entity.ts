import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ExamContentLevelEntity } from './exam-content-level.entity';

@Entity('exam_content_sections')
export class ExamContentSectionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'level_id', type: 'uuid' }) levelId: string;
  @ManyToOne(() => ExamContentLevelEntity, (l) => l.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id' }) level?: ExamContentLevelEntity;
  @Column({ name: 'section_key', type: 'varchar', length: 64 }) sectionKey: string;
  @Column({ type: 'text' }) title: string;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder: number;
  @Column({ name: 'default_duration_seconds', type: 'int', nullable: true }) defaultDurationSeconds: number | null;
  @Column({ name: 'default_weight_percent', type: 'numeric', precision: 6, scale: 2, default: 0 }) defaultWeightPercent: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
