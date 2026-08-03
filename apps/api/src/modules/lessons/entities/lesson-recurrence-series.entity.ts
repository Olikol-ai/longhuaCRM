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
import { StudentEntity } from '../../students/entities/student.entity';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { TeacherStudentContactEntity } from '../../teacher-student-contacts/entities/teacher-student-contact.entity';
import { TutorEntity } from '../../tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../../tutors/entities/tutor-student.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { LessonFormat, LessonType } from '../../lessons/entities/lesson.entity';

export type LessonRecurrenceStatus = 'active' | 'stopped';

/**
 * Rolling weekly recurrence for individual (and optional group) schedule lessons.
 * Cron keeps a forward horizon of planned lessons.
 */
@Entity('lesson_recurrence_series')
export class LessonRecurrenceSeriesEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_LESSON_RECURRENCE_TEACHER')
  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId: string | null;

  @ManyToOne(() => TeacherEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: TeacherEntity | null;

  @Index('IDX_LESSON_RECURRENCE_TUTOR')
  @Column({ name: 'tutor_id', type: 'uuid', nullable: true })
  tutorId: string | null;

  @ManyToOne(() => TutorEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tutor_id' })
  tutor?: TutorEntity | null;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @ManyToOne(() => GroupEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group?: GroupEntity | null;

  @Column({ name: 'primary_student_id', type: 'uuid', nullable: true })
  primaryStudentId: string | null;

  @ManyToOne(() => StudentEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_student_id' })
  primaryStudent?: StudentEntity | null;

  @Column({ name: 'primary_tutor_student_id', type: 'uuid', nullable: true })
  primaryTutorStudentId: string | null;

  @ManyToOne(() => TutorStudentEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_tutor_student_id' })
  primaryTutorStudent?: TutorStudentEntity | null;

  @Column({ name: 'primary_teacher_student_contact_id', type: 'uuid', nullable: true })
  primaryTeacherStudentContactId: string | null;

  @ManyToOne(() => TeacherStudentContactEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_teacher_student_contact_id' })
  primaryTeacherStudentContact?: TeacherStudentContactEntity | null;

  /** 0=Mon … 6=Sun (Europe/Minsk calendar date). */
  @Column({ type: 'smallint' })
  weekday: number;

  /** First intentional occurrence (inclusive); horizon never creates before this. */
  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ type: 'int', default: 60 })
  duration: number;

  @Column({ name: 'lesson_type', type: 'varchar', length: 32, default: 'individual' })
  lessonType: LessonType;

  @Column({ name: 'lesson_format', type: 'varchar', length: 32, default: 'online' })
  lessonFormat: LessonFormat;

  @Column({ name: 'meeting_link', type: 'text', nullable: true })
  meetingLink: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  room: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Index('IDX_LESSON_RECURRENCE_STATUS')
  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: LessonRecurrenceStatus;

  @Column({ name: 'until_date', type: 'date', nullable: true })
  untilDate: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: UserEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
