import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentEntity } from '../../students/entities/student.entity';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * Audit trail for admin lesson-balance corrections (opening / historical import).
 * Does not replace students.lesson_balance — it records intentional changes to it.
 */
@Entity('student_lesson_balance_adjustments')
export class StudentLessonBalanceAdjustmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_STUDENT_LESSON_BALANCE_ADJ_STUDENT')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => StudentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentEntity;

  @Column({ name: 'old_balance', type: 'int' })
  oldBalance: number;

  @Column({ name: 'new_balance', type: 'int' })
  newBalance: number;

  @Column({ name: 'change_amount', type: 'int' })
  changeAmount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: UserEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
