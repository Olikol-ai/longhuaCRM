import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type InstructorScheduleDigestKind = 'teacher' | 'tutor';

/**
 * One row per successful (or claimed) tomorrow-schedule Telegram digest.
 * Prevents duplicate evening sends for the same schedule date.
 */
@Entity('instructor_schedule_digests')
@Unique('UQ_instructor_schedule_digests_recipient_date', [
  'recipientKind',
  'recipientId',
  'scheduleDate',
])
export class InstructorScheduleDigestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_kind', type: 'varchar', length: 16 })
  recipientKind: InstructorScheduleDigestKind;

  @Index('IDX_instructor_schedule_digests_recipient')
  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  /** Calendar date of the lessons being announced (tomorrow). */
  @Column({ name: 'schedule_date', type: 'date' })
  scheduleDate: string;

  @CreateDateColumn({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;

  @Column({ name: 'lesson_count', type: 'int', default: 0 })
  lessonCount: number;
}
