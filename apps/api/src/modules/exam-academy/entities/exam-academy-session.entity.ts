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
import { ExamAcademyProgramVersionEntity } from './exam-academy-program-version.entity';
import { ExamAcademyLevelEntity } from './exam-academy-level.entity';
import { ExamAcademyScoringProfileEntity } from './exam-academy-scoring-profile.entity';
import { ExamAcademyMockBlueprintEntity } from './exam-academy-mock-blueprint.entity';
import { ExamAcademySessionAttemptEntity } from './exam-academy-session-attempt.entity';

@Entity('exam_academy_sessions')
export class ExamAcademySessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  mode: string;

  @Column({ name: 'program_version_id', type: 'uuid' })
  programVersionId: string;

  @ManyToOne(() => ExamAcademyProgramVersionEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'program_version_id' })
  programVersion?: ExamAcademyProgramVersionEntity;

  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => ExamAcademyLevelEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'level_id' })
  level?: ExamAcademyLevelEntity;

  @Column({ name: 'section_key', type: 'varchar', length: 64, nullable: true })
  sectionKey: string | null;

  @Column({ name: 'question_count', type: 'int', nullable: true })
  questionCount: number | null;

  @Column({ type: 'boolean', default: true })
  randomize: boolean;

  @Column({ name: 'show_correct_answers', type: 'varchar', length: 32, default: 'after_submit' })
  showCorrectAnswers: string;

  @Index('IDX_EA_SESSIONS_USER')
  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @Index('IDX_EA_SESSIONS_STUDENT')
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId: string | null;

  @Column({ name: 'assigned_by_user_id', type: 'uuid', nullable: true })
  assignedByUserId: string | null;

  @Column({ name: 'assessment_exam_id', type: 'uuid', nullable: true })
  assessmentExamId: string | null;

  @Column({ name: 'assessment_assignment_id', type: 'uuid', nullable: true })
  assessmentAssignmentId: string | null;

  @Column({ name: 'scoring_profile_id', type: 'uuid', nullable: true })
  scoringProfileId: string | null;

  @ManyToOne(() => ExamAcademyScoringProfileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'scoring_profile_id' })
  scoringProfile?: ExamAcademyScoringProfileEntity | null;

  @Column({ name: 'blueprint_id', type: 'uuid', nullable: true })
  blueprintId: string | null;

  @ManyToOne(() => ExamAcademyMockBlueprintEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'blueprint_id' })
  blueprint?: ExamAcademyMockBlueprintEntity | null;

  /** Pinned ECP blueprint edition for this session variant. */
  @Column({ name: 'blueprint_edition_id', type: 'uuid', nullable: true })
  blueprintEditionId: string | null;

  @Index('IDX_EA_SESSIONS_STATUS')
  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: string;

  @Column({ type: 'text', default: '' })
  title: string;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @OneToMany(() => ExamAcademySessionAttemptEntity, (a) => a.session)
  attempts?: ExamAcademySessionAttemptEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
