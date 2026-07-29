import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { CourseTemplateEntity } from '../../courses/entities/course-template.entity';
import { SubjectEntity } from './subject.entity';

@Entity('course_subjects')
@Unique(['courseTemplateId', 'subjectId'])
export class CourseSubjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'course_template_id', type: 'uuid' })
  courseTemplateId: string;

  @ManyToOne(() => CourseTemplateEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_template_id' })
  courseTemplate?: CourseTemplateEntity;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => SubjectEntity, (s) => s.courseSubjects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject?: SubjectEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
