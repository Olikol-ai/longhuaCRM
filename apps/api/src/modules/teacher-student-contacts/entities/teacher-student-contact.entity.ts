import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StudentEntity } from '../../students/entities/student.entity';

export type TeacherStudentContactOwnerType = 'teacher' | 'tutor';
export type TeacherStudentContactStatus = 'active' | 'inactive';

/**
 * Local scheduling notebook entry for a teacher or tutor.
 * Never a CRM User / school Student / balance / payment.
 */
@Entity('teacher_student_contacts')
@Index('IDX_TEACHER_STUDENT_CONTACTS_OWNER', ['ownerType', 'ownerId'])
export class TeacherStudentContactEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'owner_type',
    type: 'enum',
    enum: ['teacher', 'tutor'],
  })
  ownerType: TeacherStudentContactOwnerType;

  /** TeacherEntity.id or TutorEntity.id depending on ownerType. */
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  /** Optional future link to a real CRM Student. */
  @Column({ name: 'linked_student_id', type: 'uuid', nullable: true })
  linkedStudentId: string | null;

  @ManyToOne(() => StudentEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linked_student_id' })
  linkedStudent?: StudentEntity | null;

  @Column({ type: 'text', default: 'active' })
  status: TeacherStudentContactStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
