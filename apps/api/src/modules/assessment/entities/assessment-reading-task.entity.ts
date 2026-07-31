import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentLifecycleStatus } from '../enums';
import { AssessmentReadingQuestionEntity } from './assessment-reading-question.entity';
import { AssessmentReadingTaskVocabularyEntity } from './assessment-reading-task-vocabulary.entity';

@Entity('assessment_reading_tasks')
export class AssessmentReadingTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'text_content', type: 'text' })
  textContent: string;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ name: 'level_label', type: 'varchar', length: 64, nullable: true })
  levelLabel: string | null;

  @Index('IDX_ASSESSMENT_READING_TASKS_STATUS')
  @Column({ type: 'varchar', length: 32, default: ContentLifecycleStatus.Draft })
  status: ContentLifecycleStatus;

  @Index('IDX_ASSESSMENT_READING_TASKS_CREATED_BY')
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @OneToMany(() => AssessmentReadingQuestionEntity, (q) => q.task)
  questions?: AssessmentReadingQuestionEntity[];

  @OneToMany(() => AssessmentReadingTaskVocabularyEntity, (v) => v.task)
  vocabulary?: AssessmentReadingTaskVocabularyEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
