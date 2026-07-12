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
import { TeacherEntity } from '../../teachers/entities/teacher.entity';

export type AvailabilityBookingStatus = 'active' | 'cancelled';

@Entity('teacher_availability_bookings')
export class AvailabilityBookingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_AVAILABILITY_BOOKING_TEACHER_ID')
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: TeacherEntity;

  @Index('IDX_AVAILABILITY_BOOKING_LESSON_ID')
  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @ManyToOne(() => LessonEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson?: LessonEntity;

  @Index('IDX_AVAILABILITY_BOOKING_TEACHER_DATE')
  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'time_from', type: 'time' })
  timeFrom: string;

  @Column({ name: 'time_to', type: 'time' })
  timeTo: string;

  @Column({
    type: 'enum',
    enum: ['active', 'cancelled'],
    default: 'active',
  })
  status: AvailabilityBookingStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
