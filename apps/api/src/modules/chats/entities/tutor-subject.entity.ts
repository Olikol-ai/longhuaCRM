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
import { TutorEntity } from '../../tutors/entities/tutor.entity';
import { SubjectEntity } from './subject.entity';

@Entity('tutor_subjects')
@Unique(['tutorId', 'subjectId'])
export class TutorSubjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TUTOR_SUBJECTS_TUTOR')
  @Column({ name: 'tutor_id', type: 'uuid' })
  tutorId: string;

  @ManyToOne(() => TutorEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tutor_id' })
  tutor?: TutorEntity;

  @Index('IDX_TUTOR_SUBJECTS_SUBJECT')
  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => SubjectEntity, (s) => s.tutorSubjects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject?: SubjectEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
