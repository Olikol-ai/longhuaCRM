import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CourseTemplateEntity } from '../../courses/entities/course-template.entity';
import { GroupEntity } from '../../groups/entities/group.entity';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { LessonSeriesSlotEntity } from './lesson-series-slot.entity';

export type LessonSeriesStatus = 'active' | 'paused' | 'stopped';
export type LessonSeriesFormat = 'online' | 'offline';
export type LessonSeriesFrequency = 'weekly' | 'biweekly';

@Entity('lesson_series')
export class LessonSeriesEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index('IDX_LESSON_SERIES_COURSE_ID')
  @Column({ name: 'course_id', type: 'uuid', nullable: true })
  courseId: string | null;

  @ManyToOne(() => CourseTemplateEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'course_id' })
  course?: CourseTemplateEntity | null;

  @Index('IDX_LESSON_SERIES_GROUP_ID')
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @ManyToOne(() => GroupEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group?: GroupEntity | null;

  @Index('IDX_LESSON_SERIES_TEACHER_ID')
  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId: string | null;

  @ManyToOne(() => TeacherEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: TeacherEntity | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({
    type: 'enum',
    enum: ['weekly', 'biweekly'],
    default: 'weekly',
  })
  frequency: LessonSeriesFrequency;

  @Column({ name: 'total_lessons', type: 'int', default: 35 })
  totalLessons: number;

  @Column({
    type: 'enum',
    enum: ['active', 'paused', 'stopped'],
    default: 'active',
  })
  status: LessonSeriesStatus;

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
  lessonFormat: LessonSeriesFormat;

  @Column({ name: 'meeting_link', type: 'text', nullable: true })
  meetingLink: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => LessonSeriesSlotEntity, (slot) => slot.series)
  slots?: LessonSeriesSlotEntity[];
}
