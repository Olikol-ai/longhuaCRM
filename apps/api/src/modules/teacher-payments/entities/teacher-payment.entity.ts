import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LessonEntity } from '../../lessons/entities/lesson.entity';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';

export type TeacherPaymentStatus = 'pending' | 'paid';

@Entity('teacher_payments')
export class TeacherPaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TEACHER_PAYMENT_TEACHER_ID')
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: TeacherEntity;

  @Index('IDX_TEACHER_PAYMENT_LESSON_ID', { unique: true })
  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @ManyToOne(() => LessonEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson?: LessonEntity;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'paid'],
    default: 'pending',
  })
  status: TeacherPaymentStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
