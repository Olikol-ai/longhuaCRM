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
import { UserEntity } from '../../users/entities/user.entity';
import { TutorEntity } from './tutor.entity';

export type TutorStudentStatus = 'active' | 'inactive' | 'paused';

/**
 * Isolated pupil of an external tutor (Ученик репетитора).
 * Must never be mixed with school StudentEntity / students table.
 */
@Entity('tutor_students')
export class TutorStudentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TUTOR_STUDENT_TUTOR_ID')
  @Column({ name: 'tutor_id', type: 'uuid' })
  tutorId: string;

  @ManyToOne(() => TutorEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tutor_id' })
  tutor?: TutorEntity;

  @Index('IDX_TUTOR_STUDENT_USER_ID', { unique: true })
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName: string | null;

  @Index('IDX_TUTOR_STUDENT_EMAIL')
  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ name: 'telegram_id', type: 'text', nullable: true })
  telegramId: string | null;

  @Column({ name: 'telegram_username', type: 'text', nullable: true })
  telegramUsername: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'paused'],
    default: 'active',
  })
  status: TutorStudentStatus;

  @Column({ name: 'invite_link_id', type: 'uuid', nullable: true })
  inviteLinkId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
