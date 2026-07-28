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

/** 0 = Monday … 6 = Sunday (same convention as school schedule). */
@Entity('tutor_work_days')
@Unique('UQ_tutor_work_days_tutor_day', ['tutorId', 'dayOfWeek'])
export class TutorWorkDayEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TUTOR_WORK_DAYS_TUTOR_ID')
  @Column({ name: 'tutor_id', type: 'uuid' })
  tutorId: string;

  @ManyToOne(() => TutorEntity, (tutor) => tutor.workDays, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tutor_id' })
  tutor?: TutorEntity;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
