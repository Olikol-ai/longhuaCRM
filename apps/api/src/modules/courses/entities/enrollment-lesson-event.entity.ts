import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type EnrollmentLessonEventType = 'completed' | 'missed';

@Entity('enrollment_lesson_events')
@Index('UQ_enrollment_lesson_event', ['lessonId', 'studentId', 'eventType'], {
  unique: true,
})
export class EnrollmentLessonEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 32 })
  eventType: EnrollmentLessonEventType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
