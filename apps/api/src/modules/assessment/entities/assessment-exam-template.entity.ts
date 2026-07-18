import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentLifecycleStatus } from '../enums';
import { AssessmentBlueprintEntity } from './assessment-blueprint.entity';

@Entity('assessment_exam_templates')
export class AssessmentExamTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  locale: string | null;

  @Column({ name: 'level_label', type: 'text', nullable: true })
  levelLabel: string | null;

  @Index('IDX_ASSESSMENT_EXAM_TEMPLATES_STATUS')
  @Column({ type: 'varchar', length: 32, default: ContentLifecycleStatus.Draft })
  status: ContentLifecycleStatus;

  @Index('IDX_ASSESSMENT_EXAM_TEMPLATES_CREATED_BY')
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @OneToMany(() => AssessmentBlueprintEntity, (b) => b.examTemplate)
  blueprints?: AssessmentBlueprintEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
