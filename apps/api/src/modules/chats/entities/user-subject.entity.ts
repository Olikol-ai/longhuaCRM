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
import { UserEntity } from '../../users/entities/user.entity';
import { SubjectEntity } from './subject.entity';

/** How the user↔subject link was established. */
export type UserSubjectSource = 'manual' | 'derived';

@Entity('user_subjects')
@Unique(['userId', 'subjectId'])
export class UserSubjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_USER_SUBJECTS_USER')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Index('IDX_USER_SUBJECTS_SUBJECT')
  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => SubjectEntity, (s) => s.userSubjects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject?: SubjectEntity;

  /** manual = admin assign; derived = computed from learning/teaching links. */
  @Column({ type: 'varchar', length: 32, default: 'manual' })
  source: UserSubjectSource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
