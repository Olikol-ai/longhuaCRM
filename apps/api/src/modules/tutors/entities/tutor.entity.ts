import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { TutorLearningDirectionEntity } from './tutor-learning-direction.entity';
import { TutorLessonDurationEntity } from './tutor-lesson-duration.entity';
import { TutorMaterialEntity } from './tutor-material.entity';
import { TutorTeachingLanguageEntity } from './tutor-teaching-language.entity';
import { TutorWorkDayEntity } from './tutor-work-day.entity';

export type TutorStatus = 'active' | 'inactive' | 'pending';

/**
 * External partner instructor (Репетитор).
 * Separate from Teacher (school employee / payroll).
 *
 * Future split-payment fields are nullable placeholders only — no runtime finance yet:
 * - defaultLessonPrice: tutor's own lesson price
 * - commissionPercent: Longhua cut (e.g. 1)
 * - payoutAccountRef: external payout destination reference
 */
@Entity('tutors')
export class TutorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TUTOR_USER_ID', { unique: true })
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity | null;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'pending'],
    default: 'pending',
  })
  status: TutorStatus;

  @Column({ name: 'display_name', type: 'text' })
  displayName: string;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ name: 'teaching_experience', type: 'text', nullable: true })
  teachingExperience: string | null;

  /** Primary specialization, e.g. «Китайский язык». */
  @Column({ type: 'text', nullable: true })
  specialization: string | null;

  /** Legacy free-text specializations (kept for backward compatibility). */
  @Column({ type: 'text', nullable: true })
  specializations: string | null;

  @Index('IDX_TUTOR_EMAIL', { unique: true })
  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ name: 'work_time_from', type: 'time', nullable: true })
  workTimeFrom: string | null;

  @Column({ name: 'work_time_to', type: 'time', nullable: true })
  workTimeTo: string | null;

  /** Stored price only — payment not wired yet (future split-pay). */
  @Column({
    name: 'default_lesson_price',
    type: 'numeric',
    nullable: true,
  })
  defaultLessonPrice: number | null;

  /** Future: Longhua commission percent. Not used in Stage 1. */
  @Column({
    name: 'commission_percent',
    type: 'numeric',
    nullable: true,
    default: 1,
  })
  commissionPercent: number | null;

  /** Future: payout account reference. Not used in Stage 1. */
  @Column({ name: 'payout_account_ref', type: 'text', nullable: true })
  payoutAccountRef: string | null;

  @OneToMany(() => TutorLearningDirectionEntity, (row) => row.tutor)
  learningDirections?: TutorLearningDirectionEntity[];

  @OneToMany(() => TutorTeachingLanguageEntity, (row) => row.tutor)
  teachingLanguages?: TutorTeachingLanguageEntity[];

  @OneToMany(() => TutorLessonDurationEntity, (row) => row.tutor)
  lessonDurations?: TutorLessonDurationEntity[];

  @OneToMany(() => TutorWorkDayEntity, (row) => row.tutor)
  workDays?: TutorWorkDayEntity[];

  @OneToMany(() => TutorMaterialEntity, (row) => row.tutor)
  materials?: TutorMaterialEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
