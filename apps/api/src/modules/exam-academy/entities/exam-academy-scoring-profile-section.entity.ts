import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExamAcademyScoringProfileEntity } from './exam-academy-scoring-profile.entity';

@Entity('exam_academy_scoring_profile_sections')
@Index('UQ_EA_SCORING_SECTION', ['scoringProfileId', 'sectionKey'], { unique: true })
export class ExamAcademyScoringProfileSectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'scoring_profile_id', type: 'uuid' })
  scoringProfileId: string;

  @ManyToOne(() => ExamAcademyScoringProfileEntity, (p) => p.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scoring_profile_id' })
  scoringProfile?: ExamAcademyScoringProfileEntity;

  @Column({ name: 'section_key', type: 'varchar', length: 64 })
  sectionKey: string;

  @Column({ name: 'weight_percent', type: 'numeric', precision: 6, scale: 2, default: 0 })
  weightPercent: string;

  @Column({ name: 'minimum_percent', type: 'numeric', precision: 6, scale: 2, nullable: true })
  minimumPercent: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
