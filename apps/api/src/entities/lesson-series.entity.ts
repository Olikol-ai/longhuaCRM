import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type LessonSeriesStatus = 'active' | 'paused' | 'stopped';

@Entity('lesson_series')
export class LessonSeriesEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index('IDX_LESSON_SERIES_TEACHER_ID')
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'schedule_slot_id', type: 'uuid', nullable: true })
  scheduleSlotId: string | null;

  @Column({ name: 'repeat_weekly', type: 'boolean', default: true })
  repeatWeekly: boolean;

  @Column({
    type: 'enum',
    enum: ['active', 'paused', 'stopped'],
    default: 'active',
  })
  status: LessonSeriesStatus;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ type: 'int', default: 60 })
  duration: number;

  @Column({
    name: 'lesson_format',
    type: 'enum',
    enum: ['online', 'offline'],
    default: 'online',
  })
  lessonFormat: 'online' | 'offline';

  @Column({ name: 'meeting_link', type: 'text', nullable: true })
  meetingLink: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'teacher_name', type: 'text', nullable: true })
  teacherName: string | null;

  @Column({ name: 'teacher_first_name', type: 'text', nullable: true })
  teacherFirstName: string | null;

  @Column({ name: 'teacher_last_name', type: 'text', nullable: true })
  teacherLastName: string | null;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
