import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ExamContentProgramVersionEntity } from './exam-content-program-version.entity';

@Entity('exam_content_programs')
export class ExamContentProgramEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, unique: true }) code: string;
  @Column({ type: 'text' }) title: string;
  @Column({ type: 'varchar', length: 32, default: 'active' }) status: string;
  @OneToMany(() => ExamContentProgramVersionEntity, (v) => v.program) versions?: ExamContentProgramVersionEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
