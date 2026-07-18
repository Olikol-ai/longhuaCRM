import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QuestionType } from '../enums';
import { AssessmentAttemptEntity } from './assessment-attempt.entity';
import { AssessmentAnswerSnapshotEntity } from './assessment-answer-snapshot.entity';

@Entity('assessment_question_snapshots')
export class AssessmentQuestionSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_QUESTION_SNAPSHOTS_ATTEMPT')
  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId: string;

  @ManyToOne(() => AssessmentAttemptEntity, (a) => a.questionSnapshots, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attempt_id' })
  attempt?: AssessmentAttemptEntity;

  @Column({ name: 'source_question_id', type: 'uuid', nullable: true })
  sourceQuestionId: string | null;

  @Column({ name: 'section_key', type: 'varchar', length: 64 })
  sectionKey: string;

  @Column({ type: 'varchar', length: 32 })
  type: QuestionType;

  @Column({ type: 'text' })
  stem: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  points: string;

  @Column({ type: 'int', default: 1 })
  difficulty: number;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => AssessmentAnswerSnapshotEntity, (a) => a.questionSnapshot)
  answerSnapshots?: AssessmentAnswerSnapshotEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
