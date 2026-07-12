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
import { LessonEntity } from './lesson.entity';
import { StudentEntity } from '../../students/entities/student.entity';

export type AttendanceStatus =
  | 'enrolled'
  | 'attended'
  | 'missed'
  | 'missed_no_notice'
  | 'cancelled';

@Entity('attendance_records')
@Index('IDX_ATTENDANCE_LESSON_STUDENT_UNIQUE', ['lessonId', 'studentId'], {
  unique: true,
})
export class AttendanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ATTENDANCE_LESSON_ID')
  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @ManyToOne(() => LessonEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson?: LessonEntity;

  @Index('IDX_ATTENDANCE_STUDENT_ID')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => StudentEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentEntity;

  @Column({
    name: 'attendance_status',
    type: 'enum',
    enum: ['enrolled', 'attended', 'missed', 'missed_no_notice', 'cancelled'],
    default: 'enrolled',
  })
  attendanceStatus: AttendanceStatus;

  @Column({ name: 'balance_deducted', type: 'boolean', default: false })
  balanceDeducted: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
