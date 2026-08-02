import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ExamContentTopicEntity } from './exam-content-topic.entity';

@Entity('exam_content_subtopics')
export class ExamContentSubtopicEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'topic_id', type: 'uuid' }) topicId: string;
  @ManyToOne(() => ExamContentTopicEntity, (t) => t.subtopics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' }) topic?: ExamContentTopicEntity;
  @Column({ type: 'varchar', length: 64 }) code: string;
  @Column({ type: 'text' }) title: string;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
