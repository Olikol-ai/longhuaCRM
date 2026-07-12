import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TeacherAvailabilityBookingStatus = 'active' | 'cancelled';

@Entity('teacher_availability_bookings')
export class TeacherAvailabilityBookingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TAB_BOOKING_TEACHER_ID')
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Index('IDX_TAB_BOOKING_LESSON_ID')
  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @Index('IDX_TAB_BOOKING_TEACHER_DATE')
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
  status: TeacherAvailabilityBookingStatus;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
