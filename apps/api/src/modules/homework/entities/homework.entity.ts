import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HomeworkLifecycleStatus } from '../enums';
import { HomeworkItemEntity } from './homework-item.entity';
import { HomeworkAssignmentEntity } from './homework-assignment.entity';

/**
 * Homework definition (template). Not linked to AssessmentExam.
 * Questions come from shared assessment_questions via homework_items.
 */
@Entity('homeworks')
export class HomeworkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Markdown instructions shown before the student starts. */
  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Index('IDX_HOMEWORKS_STATUS')
  @Column({ type: 'varchar', length: 32, default: HomeworkLifecycleStatus.Draft })
  status: HomeworkLifecycleStatus;

  /** Primary activity kind for UI filters; items may mix section keys. */
  @Column({ name: 'activity_kind', type: 'varchar', length: 32, default: 'test' })
  activityKind: string;

  @Index('IDX_HOMEWORKS_TEACHER')
  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId: string | null;

  @Index('IDX_HOMEWORKS_CREATED_BY')
  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @Column({ name: 'pass_score_percent', type: 'numeric', precision: 5, scale: 2, nullable: true })
  passScorePercent: string | null;

  @OneToMany(() => HomeworkItemEntity, (item) => item.homework)
  items?: HomeworkItemEntity[];

  @OneToMany(() => HomeworkAssignmentEntity, (a) => a.homework)
  assignments?: HomeworkAssignmentEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
