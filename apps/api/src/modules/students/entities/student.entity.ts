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
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { TutorEntity } from '../../tutors/entities/tutor.entity';
import { UserEntity } from '../../users/entities/user.entity';

export type StudentStatus = 'active' | 'inactive' | 'paused' | 'pending_assignment';

@Entity('students')
export class StudentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName: string | null;

  @Index('IDX_STUDENT_EMAIL', { unique: true })
  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ name: 'telegram_id', type: 'text', nullable: true })
  telegramId: string | null;

  @Column({ name: 'telegram_username', type: 'text', nullable: true })
  telegramUsername: string | null;

  @Column({ name: 'telegram_connected_at', type: 'timestamptz', nullable: true })
  telegramConnectedAt: Date | null;

  @Index('IDX_STUDENT_ASSIGNED_TEACHER_ID')
  @Column({ name: 'assigned_teacher_id', type: 'uuid', nullable: true })
  assignedTeacherId: string | null;

  @ManyToOne(() => TeacherEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_teacher_id' })
  assignedTeacher?: TeacherEntity | null;

  @Index('IDX_STUDENT_ASSIGNED_TUTOR_ID')
  @Column({ name: 'assigned_tutor_id', type: 'uuid', nullable: true })
  assignedTutorId: string | null;

  @ManyToOne(() => TutorEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_tutor_id' })
  assignedTutor?: TutorEntity | null;

  @Column({ name: 'lesson_balance', type: 'int', default: 0 })
  lessonBalance: number;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'date', nullable: true })
  birthday: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'paused', 'pending_assignment'],
    default: 'active',
  })
  status: StudentStatus;

  @Index('IDX_STUDENT_USER_ID', { unique: true })
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
