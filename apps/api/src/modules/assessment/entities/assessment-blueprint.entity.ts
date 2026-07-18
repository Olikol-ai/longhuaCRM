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
import { ContentLifecycleStatus } from '../enums';
import { AssessmentExamTemplateEntity } from './assessment-exam-template.entity';
import { AssessmentBankEntity } from './assessment-bank.entity';
import { AssessmentBlueprintSectionRuleEntity } from './assessment-blueprint-section-rule.entity';

@Entity('assessment_blueprints')
export class AssessmentBlueprintEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_BLUEPRINTS_TEMPLATE_ID')
  @Column({ name: 'exam_template_id', type: 'uuid' })
  examTemplateId: string;

  @ManyToOne(() => AssessmentExamTemplateEntity, (t) => t.blueprints, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'exam_template_id' })
  examTemplate?: AssessmentExamTemplateEntity;

  @Index('IDX_ASSESSMENT_BLUEPRINTS_BANK_ID')
  @Column({ name: 'bank_id', type: 'uuid' })
  bankId: string;

  @ManyToOne(() => AssessmentBankEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bank_id' })
  bank?: AssessmentBankEntity;

  @Column({ type: 'text' })
  name: string;

  @Index('IDX_ASSESSMENT_BLUEPRINTS_STATUS')
  @Column({ type: 'varchar', length: 32, default: ContentLifecycleStatus.Draft })
  status: ContentLifecycleStatus;

  @Index('IDX_ASSESSMENT_BLUEPRINTS_CREATED_BY')
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @OneToMany(() => AssessmentBlueprintSectionRuleEntity, (r) => r.blueprint)
  sectionRules?: AssessmentBlueprintSectionRuleEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
