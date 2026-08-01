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
import { ExamAcademyLevelEntity } from './exam-academy-level.entity';
import { ExamAcademyScoringProfileSectionEntity } from './exam-academy-scoring-profile-section.entity';

@Entity('exam_academy_scoring_profiles')
@Index('UQ_EA_SCORING_LEVEL_CODE', ['levelId', 'code'], { unique: true })
export class ExamAcademyScoringProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => ExamAcademyLevelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id' })
  level?: ExamAcademyLevelEntity;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'passing_mode', type: 'varchar', length: 32, default: 'percent' })
  passingMode: string;

  @Column({ name: 'pass_score', type: 'numeric', precision: 10, scale: 2, nullable: true })
  passScore: string | null;

  @Column({ name: 'pass_score_percent', type: 'numeric', precision: 6, scale: 2, nullable: true })
  passScorePercent: string | null;

  @Column({ name: 'grader_kind', type: 'varchar', length: 32, default: 'auto' })
  graderKind: string;

  @Column({ name: 'auto_grade', type: 'boolean', default: true })
  autoGrade: boolean;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string;

  @OneToMany(() => ExamAcademyScoringProfileSectionEntity, (s) => s.scoringProfile)
  sections?: ExamAcademyScoringProfileSectionEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
