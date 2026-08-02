import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ExamContentProgramEntity } from './exam-content-program.entity';
import { ExamContentLevelEntity } from './exam-content-level.entity';

@Entity('exam_content_program_versions')
export class ExamContentProgramVersionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'program_id', type: 'uuid' }) programId: string;
  @ManyToOne(() => ExamContentProgramEntity, (p) => p.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' }) program?: ExamContentProgramEntity;
  @Column({ type: 'varchar', length: 64, unique: true }) code: string;
  @Column({ type: 'text' }) title: string;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder: number;
  @Column({ type: 'varchar', length: 32, default: 'active' }) status: string;
  @OneToMany(() => ExamContentLevelEntity, (l) => l.version) levels?: ExamContentLevelEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
