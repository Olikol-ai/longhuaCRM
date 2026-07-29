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
import { AssessmentListeningQuestionEntity } from './assessment-listening-question.entity';

@Entity('assessment_listening_tasks')
export class AssessmentListeningTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ name: 'level_label', type: 'varchar', length: 64, nullable: true })
  levelLabel: string | null;

  @Column({ name: 'audio_storage_key', type: 'text', nullable: true })
  audioStorageKey: string | null;

  @Column({ name: 'audio_mime', type: 'varchar', length: 128, nullable: true })
  audioMime: string | null;

  @Column({ name: 'audio_original_filename', type: 'text', nullable: true })
  audioOriginalFilename: string | null;

  @Index('IDX_ASSESSMENT_LISTENING_TASKS_STATUS')
  @Column({ type: 'varchar', length: 32, default: ContentLifecycleStatus.Draft })
  status: ContentLifecycleStatus;

  @Index('IDX_ASSESSMENT_LISTENING_TASKS_CREATED_BY')
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @OneToMany(() => AssessmentListeningQuestionEntity, (q) => q.task)
  questions?: AssessmentListeningQuestionEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
