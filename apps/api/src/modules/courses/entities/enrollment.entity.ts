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
import { CourseTemplateEntity } from './course-template.entity';
import { StudentEntity } from '../../students/entities/student.entity';

export type EnrollmentStatus = 'active' | 'completed' | 'paused';

@Entity('enrollments')
export class EnrollmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ENROLLMENT_STUDENT_ID')
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId: string | null;

  @ManyToOne(() => StudentEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentEntity | null;

  @Index('IDX_ENROLLMENT_COURSE_TEMPLATE_ID')
  @Column({ name: 'course_template_id', type: 'uuid', nullable: true })
  courseTemplateId: string | null;

  @ManyToOne(() => CourseTemplateEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'course_template_id' })
  courseTemplate?: CourseTemplateEntity | null;

  @Column({ name: 'course_name', type: 'text', nullable: true })
  courseName: string | null;

  @Column({ name: 'completed_lessons', type: 'int', default: 0 })
  completedLessons: number;

  @Column({ name: 'missed_lessons', type: 'int', default: 0 })
  missedLessons: number;

  @Column({ name: 'total_lessons', type: 'int', default: 35 })
  totalLessons: number;

  @Column({
    type: 'enum',
    enum: ['active', 'completed', 'paused'],
    default: 'active',
  })
  status: EnrollmentStatus;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
