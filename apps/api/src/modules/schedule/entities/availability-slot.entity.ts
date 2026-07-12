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
import { TeacherEntity } from '../../teachers/entities/teacher.entity';

@Entity('teacher_availability_slots')
export class AvailabilitySlotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_AVAILABILITY_SLOT_TEACHER_ID')
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: TeacherEntity;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  @Column({ name: 'time_from', type: 'time' })
  timeFrom: string;

  @Column({ name: 'time_to', type: 'time' })
  timeTo: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
