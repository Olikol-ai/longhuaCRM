import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ExamContentBlueprintEditionEntity } from './exam-content-blueprint-edition.entity';
import { ExamContentEditionBlockEntity } from './exam-content-edition-block.entity';

@Entity('exam_content_edition_sections')
export class ExamContentEditionSectionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'edition_id', type: 'uuid' }) editionId: string;
  @ManyToOne(() => ExamContentBlueprintEditionEntity, (e) => e.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'edition_id' }) edition?: ExamContentBlueprintEditionEntity;
  @Column({ name: 'section_key', type: 'varchar', length: 64 }) sectionKey: string;
  @Column({ type: 'text' }) title: string;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder: number;
  @Column({ name: 'duration_seconds', type: 'int', nullable: true }) durationSeconds: number | null;
  @Column({ name: 'weight_percent', type: 'numeric', precision: 6, scale: 2, default: 0 }) weightPercent: string;
  @OneToMany(() => ExamContentEditionBlockEntity, (b) => b.section) blocks?: ExamContentEditionBlockEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
