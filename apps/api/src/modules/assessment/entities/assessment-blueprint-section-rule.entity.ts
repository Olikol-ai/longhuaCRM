import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssessmentBlueprintEntity } from './assessment-blueprint.entity';

@Entity('assessment_blueprint_section_rules')
@Index('UQ_ASSESSMENT_BLUEPRINT_SECTION_KEY', ['blueprintId', 'sectionKey'], { unique: true })
export class AssessmentBlueprintSectionRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_BLUEPRINT_SECTION_RULES_BP')
  @Column({ name: 'blueprint_id', type: 'uuid' })
  blueprintId: string;

  @ManyToOne(() => AssessmentBlueprintEntity, (b) => b.sectionRules, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'blueprint_id' })
  blueprint?: AssessmentBlueprintEntity;

  @Column({ name: 'section_key', type: 'varchar', length: 64 })
  sectionKey: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'question_count', type: 'int' })
  questionCount: number;

  /** Allowed QuestionType values for this section (relational text rows via array). */
  @Column({ name: 'question_types', type: 'text', array: true, default: '{}' })
  questionTypes: string[];

  @Column({ name: 'difficulty_min', type: 'int', default: 1 })
  difficultyMin: number;

  @Column({ name: 'difficulty_max', type: 'int', default: 5 })
  difficultyMax: number;

  /** Optional free-text topic filter label (legacy-friendly). Prefer topicIds. */
  @Column({ name: 'topic_filter', type: 'text', nullable: true })
  topicFilter: string | null;

  /** Topic UUID filters (not JSONB — native uuid array for pool selection). */
  @Column({ name: 'topic_ids', type: 'uuid', array: true, default: '{}' })
  topicIds: string[];

  /** Section contribution to weighted percent (e.g. 30). */
  @Column({ type: 'numeric', precision: 6, scale: 2 })
  weight: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
