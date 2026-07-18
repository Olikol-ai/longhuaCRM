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
import { AssignmentStatus, AssignmentTargetType } from '../enums';
import { AssessmentExamEntity } from './assessment-exam.entity';
import { AssessmentRuleEntity } from './assessment-rule.entity';

@Entity('assessment_exam_assignments')
export class AssessmentExamAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_ASSIGNMENTS_EXAM_ID')
  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @ManyToOne(() => AssessmentExamEntity, (e) => e.assignments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'exam_id' })
  exam?: AssessmentExamEntity;

  @Column({ name: 'target_type', type: 'varchar', length: 32 })
  targetType: AssignmentTargetType;

  /** CRM entity id for target_type, or nil uuid for public. */
  @Index('IDX_ASSESSMENT_ASSIGNMENTS_TARGET')
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @Index('IDX_ASSESSMENT_ASSIGNMENTS_STATUS')
  @Column({ type: 'varchar', length: 32, default: AssignmentStatus.Draft })
  status: AssignmentStatus;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'valid_to', type: 'timestamptz', nullable: true })
  validTo: Date | null;

  @Column({ name: 'assessment_rule_override_id', type: 'uuid', nullable: true })
  assessmentRuleOverrideId: string | null;

  @ManyToOne(() => AssessmentRuleEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assessment_rule_override_id' })
  assessmentRuleOverride?: AssessmentRuleEntity | null;

  @Index('IDX_ASSESSMENT_ASSIGNMENTS_ASSIGNED_BY')
  @Column({ name: 'assigned_by_user_id', type: 'uuid', nullable: true })
  assignedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
