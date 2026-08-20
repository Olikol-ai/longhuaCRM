import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TeacherStudentContactEntity } from './teacher-student-contact.entity';

/**
 * Private lesson-pack balance for tutor notebook contacts only.
 *
 * School teachers never use this table — their SSOT is students.lesson_balance.
 * teacher_student_contacts has no balance column (removed after Student SSOT).
 */
@Entity('tutor_contact_balances')
export class TutorContactBalanceEntity {
  @PrimaryColumn({ name: 'contact_id', type: 'uuid' })
  contactId: string;

  @OneToOne(() => TeacherStudentContactEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contact_id' })
  contact?: TeacherStudentContactEntity;

  @Column({ name: 'lesson_balance', type: 'int', default: 0 })
  lessonBalance: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
