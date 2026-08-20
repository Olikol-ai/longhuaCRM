import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentLifecycleStatus } from '../enums';
import { AssessmentRuleEntity } from './assessment-rule.entity';
import { AssessmentSectionEntity } from './assessment-section.entity';
import { AssessmentExamQuestionEntity } from './assessment-exam-question.entity';
import { AssessmentExamAssignmentEntity } from './assessment-exam-assignment.entity';
import { AssessmentExamPartEntity } from './assessment-exam-part.entity';

@Entity('assessment_exams')
export class AssessmentExamEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  /** Learner-facing description shown before starting the exam. */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index('IDX_ASSESSMENT_EXAMS_STATUS')
  @Column({ type: 'varchar', length: 32, default: ContentLifecycleStatus.Draft })
  status: ContentLifecycleStatus;

  /** Origin of the exam: CRM Assessment vs Exam Academy materialization. */
  @Index('IDX_ASSESSMENT_EXAMS_SOURCE')
  @Column({ type: 'varchar', length: 32, default: 'assessment' })
  source: string;

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

  @OneToMany(() => AssessmentExamPartEntity, (p) => p.exam)
  parts?: AssessmentExamPartEntity[];

  @OneToMany(() => AssessmentExamAssignmentEntity, (a) => a.exam)
  assignments?: AssessmentExamAssignmentEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
