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
import { TutorEntity } from './tutor.entity';

export const TUTOR_ALLOWED_LESSON_DURATIONS = [30, 60, 90, 120] as const;
export type TutorLessonDurationMinutes =
  (typeof TUTOR_ALLOWED_LESSON_DURATIONS)[number];

@Entity('tutor_lesson_durations')
@Unique('UQ_tutor_lesson_durations_tutor_minutes', ['tutorId', 'minutes'])
export class TutorLessonDurationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TUTOR_LESSON_DURATIONS_TUTOR_ID')
  @Column({ name: 'tutor_id', type: 'uuid' })
  tutorId: string;

  @ManyToOne(() => TutorEntity, (tutor) => tutor.lessonDurations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tutor_id' })
  tutor?: TutorEntity;

  @Column({ type: 'int' })
  minutes: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
