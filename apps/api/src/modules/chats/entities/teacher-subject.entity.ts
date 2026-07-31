import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { SubjectEntity } from './subject.entity';

@Entity('teacher_subjects')
@Unique(['teacherId', 'subjectId'])
export class TeacherSubjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TEACHER_SUBJECTS_TEACHER')
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: TeacherEntity;

  @Index('IDX_TEACHER_SUBJECTS_SUBJECT')
  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => SubjectEntity, (s) => s.teacherSubjects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject?: SubjectEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
