import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ExamContentSectionEntity } from './exam-content-section.entity';

@Entity('exam_content_subsections')
export class ExamContentSubsectionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'section_id', type: 'uuid' }) sectionId: string;
  @ManyToOne(() => ExamContentSectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' }) section?: ExamContentSectionEntity;
  @Column({ type: 'varchar', length: 64 }) code: string;
  @Column({ type: 'text' }) title: string;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
