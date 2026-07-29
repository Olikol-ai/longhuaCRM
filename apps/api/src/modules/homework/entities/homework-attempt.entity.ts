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
import { HomeworkAttemptStatus } from '../enums';
import { HomeworkAssignmentEntity } from './homework-assignment.entity';
import { HomeworkQuestionSnapshotEntity } from './homework-question-snapshot.entity';
import { HomeworkAttemptAnswerEntity } from './homework-attempt-answer.entity';
import { HomeworkResultEntity } from './homework-result.entity';

@Entity('homework_attempts')
export class HomeworkAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_ATTEMPTS_ASSIGNMENT')
  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @ManyToOne(() => HomeworkAssignmentEntity, (a) => a.attempts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assignment_id' })
  assignment?: HomeworkAssignmentEntity;

  @Index('IDX_HOMEWORK_ATTEMPTS_HOMEWORK')
  @Column({ name: 'homework_id', type: 'uuid' })
  homeworkId: string;

  @Index('IDX_HOMEWORK_ATTEMPTS_STUDENT')
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId: string | null;

  @Index('IDX_HOMEWORK_ATTEMPTS_TUTOR_STUDENT')
  @Column({ name: 'tutor_student_id', type: 'uuid', nullable: true })
  tutorStudentId: string | null;

  @Index('IDX_HOMEWORK_ATTEMPTS_USER')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32, default: HomeworkAttemptStatus.Started })
  status: HomeworkAttemptStatus;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @OneToMany(() => HomeworkQuestionSnapshotEntity, (s) => s.attempt)
  questionSnapshots?: HomeworkQuestionSnapshotEntity[];

  @OneToMany(() => HomeworkAttemptAnswerEntity, (a) => a.attempt)
  answers?: HomeworkAttemptAnswerEntity[];

  @OneToOne(() => HomeworkResultEntity, (r) => r.attempt)
  result?: HomeworkResultEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
