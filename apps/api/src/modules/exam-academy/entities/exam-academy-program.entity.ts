import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExamAcademyProgramVersionEntity } from './exam-academy-program-version.entity';

@Entity('exam_academy_programs')
export class ExamAcademyProgramEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_EA_PROGRAMS_CODE', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string;

  @OneToMany(() => ExamAcademyProgramVersionEntity, (v) => v.program)
  versions?: ExamAcademyProgramVersionEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
