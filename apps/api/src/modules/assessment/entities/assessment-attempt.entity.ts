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
import { AttemptStatus, SubmitReason } from '../enums';
import { AssessmentExamEntity } from './assessment-exam.entity';
import { AssessmentExamAssignmentEntity } from './assessment-exam-assignment.entity';
import { AssessmentQuestionSnapshotEntity } from './assessment-question-snapshot.entity';
import { AssessmentResultEntity } from './assessment-result.entity';

@Entity('assessment_attempts')
export class AssessmentAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_ATTEMPTS_EXAM_ID')
  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @ManyToOne(() => AssessmentExamEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam?: AssessmentExamEntity;

  @Index('IDX_ASSESSMENT_ATTEMPTS_ASSIGNMENT_ID')
  @Column({ name: 'assignment_id', type: 'uuid', nullable: true })
  assignmentId: string | null;

  @ManyToOne(() => AssessmentExamAssignmentEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'assignment_id' })
  assignment?: AssessmentExamAssignmentEntity | null;

  @Index('IDX_ASSESSMENT_ATTEMPTS_STATUS')
  @Column({ type: 'varchar', length: 32, default: AttemptStatus.Created })
  status: AttemptStatus;

  @Column({ name: 'submit_reason', type: 'varchar', length: 16, nullable: true })
  submitReason: SubmitReason | null;

  @Column({ name: 'attempt_number', type: 'int' })
  attemptNumber: number;

  @Index('IDX_ASSESSMENT_ATTEMPTS_STUDENT_ID')
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId: string | null;

  @Index('IDX_ASSESSMENT_ATTEMPTS_TEACHER_ID')
  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId: string | null;

  @Index('IDX_ASSESSMENT_ATTEMPTS_USER_ID')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @OneToMany(() => AssessmentQuestionSnapshotEntity, (s) => s.attempt)
  questionSnapshots?: AssessmentQuestionSnapshotEntity[];

  @OneToOne(() => AssessmentResultEntity, (r) => r.attempt)
  result?: AssessmentResultEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
