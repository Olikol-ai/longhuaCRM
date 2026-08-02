import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ExamContentEditionSectionEntity } from './exam-content-edition-section.entity';
import { ExamContentEditionBlockSlotEntity } from './exam-content-edition-block-slot.entity';

@Entity('exam_content_edition_blocks')
export class ExamContentEditionBlockEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'section_id', type: 'uuid' }) sectionId: string;
  @ManyToOne(() => ExamContentEditionSectionEntity, (s) => s.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' }) section?: ExamContentEditionSectionEntity;
  @Column({ type: 'text' }) title: string;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder: number;
  @Column({ name: 'duration_seconds', type: 'int', nullable: true }) durationSeconds: number | null;
  @OneToMany(() => ExamContentEditionBlockSlotEntity, (s) => s.block) slots?: ExamContentEditionBlockSlotEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
