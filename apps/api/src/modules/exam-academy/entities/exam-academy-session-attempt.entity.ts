import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExamAcademySessionEntity } from './exam-academy-session.entity';

@Entity('exam_academy_session_attempts')
export class ExamAcademySessionAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_EA_SESSION_ATTEMPTS_SESSION')
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => ExamAcademySessionEntity, (s) => s.attempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session?: ExamAcademySessionEntity;

  @Index('UQ_EA_SESSION_ATTEMPTS_ATTEMPT', { unique: true })
  @Column({ name: 'assessment_attempt_id', type: 'uuid' })
  assessmentAttemptId: string;

  @Column({ name: 'attempt_number', type: 'int', default: 1 })
  attemptNumber: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
