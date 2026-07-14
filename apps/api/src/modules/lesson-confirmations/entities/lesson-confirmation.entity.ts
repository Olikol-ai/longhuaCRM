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
import { LessonEntity } from '../../lessons/entities/lesson.entity';
import { StudentEntity } from '../../students/entities/student.entity';

export enum LessonConfirmationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DECLINED = 'DECLINED',
}

@Entity('lesson_confirmations')
@Index('UQ_lesson_confirmations_lesson_student', ['lessonId', 'studentId'], {
  unique: true,
})
export class LessonConfirmationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_lesson_confirmations_lesson_id')
  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @ManyToOne(() => LessonEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson?: LessonEntity;

  @Index('IDX_lesson_confirmations_student_id')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => StudentEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentEntity;

  @Index('IDX_lesson_confirmations_telegram_chat_id')
  @Column({ name: 'telegram_chat_id', type: 'varchar', length: 64, nullable: true })
  telegramChatId: string | null;

  @Index('IDX_lesson_confirmations_status')
  @Column({
    type: 'enum',
    enum: LessonConfirmationStatus,
    enumName: 'lesson_confirmation_status',
    default: LessonConfirmationStatus.PENDING,
  })
  status: LessonConfirmationStatus;

  @Column({ name: 'requested_at', type: 'timestamptz', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'declined_at', type: 'timestamptz', nullable: true })
  declinedAt: Date | null;

  @Column({ name: 'decline_reason', type: 'text', nullable: true })
  declineReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
