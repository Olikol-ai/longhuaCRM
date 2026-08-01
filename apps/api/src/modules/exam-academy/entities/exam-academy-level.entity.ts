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
import { ExamAcademySectionTemplateEntity } from './exam-academy-section-template.entity';

@Entity('exam_academy_levels')
@Index('UQ_EA_LEVELS_VERSION_CODE', ['versionId', 'code'], { unique: true })
export class ExamAcademyLevelEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_EA_LEVELS_VERSION')
  @Column({ name: 'version_id', type: 'uuid' })
  versionId: string;

  @ManyToOne(() => ExamAcademyProgramVersionEntity, (v) => v.levels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version?: ExamAcademyProgramVersionEntity;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string;

  @OneToMany(() => ExamAcademySectionTemplateEntity, (s) => s.level)
  sectionTemplates?: ExamAcademySectionTemplateEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
