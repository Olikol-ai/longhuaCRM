import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentLifecycleStatus } from '../enums';
import { AssessmentBlueprintEntity } from './assessment-blueprint.entity';
import { AssessmentRuleEntity } from './assessment-rule.entity';
import { AssessmentSectionEntity } from './assessment-section.entity';
import { AssessmentExamQuestionEntity } from './assessment-exam-question.entity';
import { AssessmentExamAssignmentEntity } from './assessment-exam-assignment.entity';

@Entity('assessment_exams')
export class AssessmentExamEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_EXAMS_BLUEPRINT_ID')
  @Column({ name: 'blueprint_id', type: 'uuid' })
  blueprintId: string;

  @ManyToOne(() => AssessmentBlueprintEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'blueprint_id' })
  blueprint?: AssessmentBlueprintEntity;

  @Column({ type: 'text' })
  name: string;

  @Index('IDX_ASSESSMENT_EXAMS_STATUS')
  @Column({ type: 'varchar', length: 32, default: ContentLifecycleStatus.Draft })
  status: ContentLifecycleStatus;

  @Column({ name: 'available_from', type: 'timestamptz', nullable: true })
  availableFrom: Date | null;

  @Column({ name: 'available_to', type: 'timestamptz', nullable: true })
  availableTo: Date | null;

  @Index('IDX_ASSESSMENT_EXAMS_CREATED_BY')
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @OneToOne(() => AssessmentRuleEntity, (r) => r.exam)
  rule?: AssessmentRuleEntity;

  @OneToMany(() => AssessmentSectionEntity, (s) => s.exam)
  sections?: AssessmentSectionEntity[];

  @OneToMany(() => AssessmentExamQuestionEntity, (q) => q.exam)
  examQuestions?: AssessmentExamQuestionEntity[];

  @OneToMany(() => AssessmentExamAssignmentEntity, (a) => a.exam)
  assignments?: AssessmentExamAssignmentEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
