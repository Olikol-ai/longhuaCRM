import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExamAcademyMockBlueprintEntity } from './exam-academy-mock-blueprint.entity';
import { ExamAcademySectionTemplateEntity } from './exam-academy-section-template.entity';

@Entity('exam_academy_mock_blueprint_sections')
export class ExamAcademyMockBlueprintSectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'blueprint_id', type: 'uuid' })
  blueprintId: string;

  @ManyToOne(() => ExamAcademyMockBlueprintEntity, (b) => b.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blueprint_id' })
  blueprint?: ExamAcademyMockBlueprintEntity;

  @Column({ name: 'section_template_id', type: 'uuid' })
  sectionTemplateId: string;

  @ManyToOne(() => ExamAcademySectionTemplateEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'section_template_id' })
  sectionTemplate?: ExamAcademySectionTemplateEntity;

  @Column({ name: 'select_count', type: 'int', default: 1 })
  selectCount: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
