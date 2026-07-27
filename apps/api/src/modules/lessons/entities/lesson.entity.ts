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
import { GroupEntity } from '../../groups/entities/group.entity';
import { LessonSeriesEntity } from '../../lesson-series/entities/lesson-series.entity';
import { StudentEntity } from '../../students/entities/student.entity';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { TutorEntity } from '../../tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../../tutors/entities/tutor-student.entity';

export const LESSON_STATUSES = [
  'planned',
  'completed',
  'cancelled',
  'rescheduled',
  'missed',
  'missed_no_notice',
] as const;

export type LessonStatus = (typeof LESSON_STATUSES)[number];

/**
 * Statuses that occupy teacher/student calendar time for conflict checks.
 * Cancelled / rescheduled / missed* free the slot and must not block create/reschedule.
 */
export const SCHEDULE_OCCUPYING_LESSON_STATUSES = [
  'planned',
  'completed',
] as const satisfies ReadonlyArray<LessonStatus>;

export type ScheduleOccupyingLessonStatus =
  (typeof SCHEDULE_OCCUPYING_LESSON_STATUSES)[number];

export function isScheduleOccupyingLessonStatus(
  status: string,
): status is ScheduleOccupyingLessonStatus {
  return (SCHEDULE_OCCUPYING_LESSON_STATUSES as readonly string[]).includes(status);
}

export type LessonFormat = 'online' | 'offline';
export type LessonType = 'individual' | 'group';

@Entity('lessons')
export class LessonEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_LESSON_TEACHER_ID')
  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId: string | null;

  @ManyToOne(() => TeacherEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: TeacherEntity | null;

  @Index('IDX_LESSON_TUTOR_ID')
  @Column({ name: 'tutor_id', type: 'uuid', nullable: true })
  tutorId: string | null;

  @ManyToOne(() => TutorEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tutor_id' })
  tutor?: TutorEntity | null;

  @Index('IDX_LESSON_SERIES_ID')
  @Column({ name: 'series_id', type: 'uuid', nullable: true })
  seriesId: string | null;

  @ManyToOne(() => LessonSeriesEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'series_id' })
  series?: LessonSeriesEntity | null;

  @Index('IDX_LESSON_GROUP_ID')
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @ManyToOne(() => GroupEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group?: GroupEntity | null;

  @Index('IDX_LESSON_PRIMARY_STUDENT_ID')
  @Column({ name: 'primary_student_id', type: 'uuid', nullable: true })
  primaryStudentId: string | null;

  @ManyToOne(() => StudentEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_student_id' })
  primaryStudent?: StudentEntity | null;

  /** Isolated tutor pupil (never a school Student). Used when tutorId is set. */
  @Index('IDX_LESSON_PRIMARY_TUTOR_STUDENT_ID')
  @Column({ name: 'primary_tutor_student_id', type: 'uuid', nullable: true })
  primaryTutorStudentId: string | null;

  @ManyToOne(() => TutorStudentEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_tutor_student_id' })
  primaryTutorStudent?: TutorStudentEntity | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ type: 'int', default: 60 })
  duration: number;

  @Column({
    type: 'enum',
    enum: LESSON_STATUSES,
    default: 'planned',
  })
  status: LessonStatus;

  @Column({
    name: 'lesson_type',
    type: 'enum',
    enum: ['individual', 'group'],
    default: 'individual',
  })
  lessonType: LessonType;

  @Column({
    name: 'lesson_format',
    type: 'enum',
    enum: ['online', 'offline'],
    default: 'online',
  })
  lessonFormat: LessonFormat;

  @Column({ name: 'meeting_link', type: 'text', nullable: true })
  meetingLink: string | null;

  /** Classroom / cabinet label for offline lessons. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  room: string | null;

  @Column({ name: 'reminder_24h_sent', type: 'boolean', default: false })
  reminder24hSent: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
