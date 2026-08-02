import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ExamContentProgramVersionEntity } from './exam-content-program-version.entity';
import { ExamContentSubtopicEntity } from './exam-content-subtopic.entity';

@Entity('exam_content_topics')
export class ExamContentTopicEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'version_id', type: 'uuid' }) versionId: string;
  @ManyToOne(() => ExamContentProgramVersionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' }) version?: ExamContentProgramVersionEntity;
  @Column({ type: 'varchar', length: 64 }) code: string;
  @Column({ type: 'text' }) title: string;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder: number;
  @OneToMany(() => ExamContentSubtopicEntity, (s) => s.topic) subtopics?: ExamContentSubtopicEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
