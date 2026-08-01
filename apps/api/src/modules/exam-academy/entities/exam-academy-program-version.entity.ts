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
import { ExamAcademyProgramEntity } from './exam-academy-program.entity';
import { ExamAcademyLevelEntity } from './exam-academy-level.entity';

@Entity('exam_academy_program_versions')
export class ExamAcademyProgramVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_EA_VERSIONS_PROGRAM')
  @Column({ name: 'program_id', type: 'uuid' })
  programId: string;

  @ManyToOne(() => ExamAcademyProgramEntity, (p) => p.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program?: ExamAcademyProgramEntity;

  @Index('UQ_EA_VERSIONS_CODE', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string;

  @OneToMany(() => ExamAcademyLevelEntity, (l) => l.version)
  levels?: ExamAcademyLevelEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
