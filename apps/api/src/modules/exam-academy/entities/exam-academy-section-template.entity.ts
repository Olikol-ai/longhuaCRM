import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExamAcademyLevelEntity } from './exam-academy-level.entity';
import { ExamAcademySectionTemplateItemTypeEntity } from './exam-academy-section-template-item-type.entity';

@Entity('exam_academy_section_templates')
@Index('UQ_EA_SECTION_TEMPLATES_LEVEL_KEY', ['levelId', 'sectionKey'], { unique: true })
export class ExamAcademySectionTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_EA_SECTION_TEMPLATES_LEVEL')
  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => ExamAcademyLevelEntity, (l) => l.sectionTemplates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id' })
  level?: ExamAcademyLevelEntity;

  @Column({ name: 'section_key', type: 'varchar', length: 64 })
  sectionKey: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'default_duration_seconds', type: 'int', nullable: true })
  defaultDurationSeconds: number | null;

  @Column({ name: 'default_weight_percent', type: 'numeric', precision: 6, scale: 2, default: 0 })
  defaultWeightPercent: string;

  @OneToMany(() => ExamAcademySectionTemplateItemTypeEntity, (i) => i.sectionTemplate)
  itemTypes?: ExamAcademySectionTemplateItemTypeEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
