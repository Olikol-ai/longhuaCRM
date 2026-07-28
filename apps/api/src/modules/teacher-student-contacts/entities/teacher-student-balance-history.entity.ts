import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TeacherStudentContactEntity } from './teacher-student-contact.entity';

/**
 * Manual or automatic balance change for a private TeacherStudentContact.
 * Never linked to school payments.
 */
@Entity('teacher_student_balance_history')
@Index('IDX_TEACHER_STUDENT_BALANCE_HISTORY_CONTACT', ['studentContactId'])
export class TeacherStudentBalanceHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_contact_id', type: 'uuid' })
  studentContactId: string;

  @ManyToOne(() => TeacherStudentContactEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_contact_id' })
  studentContact?: TeacherStudentContactEntity;

  @Column({ name: 'old_balance', type: 'int' })
  oldBalance: number;

  @Column({ name: 'new_balance', type: 'int' })
  newBalance: number;

  @Column({ name: 'change_amount', type: 'int' })
  changeAmount: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** User.id of the actor; null for system auto deduct/restore. */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;
}
