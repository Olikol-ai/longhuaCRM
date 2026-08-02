import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ExamContentProgramVersionEntity } from './exam-content-program-version.entity';
import { ExamContentSectionEntity } from './exam-content-section.entity';

@Entity('exam_content_levels')
export class ExamContentLevelEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'version_id', type: 'uuid' }) versionId: string;
  @ManyToOne(() => ExamContentProgramVersionEntity, (v) => v.levels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' }) version?: ExamContentProgramVersionEntity;
  @Column({ type: 'varchar', length: 64 }) code: string;
  @Column({ type: 'text' }) title: string;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder: number;
  @Column({ type: 'varchar', length: 32, default: 'active' }) status: string;
  @OneToMany(() => ExamContentSectionEntity, (s) => s.level) sections?: ExamContentSectionEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
