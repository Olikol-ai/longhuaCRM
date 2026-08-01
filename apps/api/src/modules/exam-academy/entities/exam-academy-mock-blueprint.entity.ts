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
import { ExamAcademyScoringProfileEntity } from './exam-academy-scoring-profile.entity';
import { ExamAcademyMockBlueprintSectionEntity } from './exam-academy-mock-blueprint-section.entity';

@Entity('exam_academy_mock_blueprints')
export class ExamAcademyMockBlueprintEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_EA_BLUEPRINTS_LEVEL')
  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => ExamAcademyLevelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id' })
  level?: ExamAcademyLevelEntity;

  @Column({ name: 'scoring_profile_id', type: 'uuid', nullable: true })
  scoringProfileId: string | null;

  @ManyToOne(() => ExamAcademyScoringProfileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'scoring_profile_id' })
  scoringProfile?: ExamAcademyScoringProfileEntity | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: string;

  @Column({ type: 'int', default: 1 })
  revision: number;

  @Column({ name: 'total_duration_seconds', type: 'int', default: 0 })
  totalDurationSeconds: number;

  @Column({ name: 'supersedes_blueprint_id', type: 'uuid', nullable: true })
  supersedesBlueprintId: string | null;

  @OneToMany(() => ExamAcademyMockBlueprintSectionEntity, (s) => s.blueprint)
  sections?: ExamAcademyMockBlueprintSectionEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
