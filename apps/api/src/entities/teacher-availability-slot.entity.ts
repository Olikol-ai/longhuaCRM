import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('teacher_availability_slots')
export class TeacherAvailabilitySlotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TA_SLOT_TEACHER_ID')
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  @Column({ name: 'time_from', type: 'time' })
  timeFrom: string;

  @Column({ name: 'time_to', type: 'time' })
  timeTo: string;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
