import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LessonEntity } from './lesson.entity';

export type LessonStudentTargetType =
  | 'student'
  | 'tutor_student'
  | 'teacher_student_contact';

@Entity('lesson_student_change_history')
export class LessonStudentChangeHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_LESSON_STUDENT_CHANGE_HISTORY_LESSON')
  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @ManyToOne(() => LessonEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson?: LessonEntity;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ name: 'actor_role', type: 'varchar', length: 32 })
  actorRole: string;

  @Column({ name: 'old_target_type', type: 'varchar', length: 32, nullable: true })
  oldTargetType: LessonStudentTargetType | null;

  @Column({ name: 'old_target_id', type: 'uuid', nullable: true })
  oldTargetId: string | null;

  @Column({ name: 'old_display_name', type: 'text', nullable: true })
  oldDisplayName: string | null;

  @Column({ name: 'new_target_type', type: 'varchar', length: 32 })
  newTargetType: LessonStudentTargetType;

  @Column({ name: 'new_target_id', type: 'uuid' })
  newTargetId: string;

  @Column({ name: 'new_display_name', type: 'text' })
  newDisplayName: string;

  @Column({ name: 'balance_restored', type: 'boolean', default: false })
  balanceRestored: boolean;

  @Column({ name: 'balance_deducted', type: 'boolean', default: false })
  balanceDeducted: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
