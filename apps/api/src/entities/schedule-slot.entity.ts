import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  export type LessonType = 'individual' | 'group';
  export type LessonFormat = 'online' | 'offline';
  export type SlotStatus = 'open' | 'booked' | 'cancelled';
  
  @Entity('schedule_slots')
  export class ScheduleSlotEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index('IDX_SCHEDULE_SLOT_TEACHER_ID')
    @Column({ name: 'teacher_id', type: 'uuid' })
    teacherId: string;
  
    @Column({ type: 'date' })
    date: string;
  
    @Column({ name: 'start_time', type: 'time' })
    startTime: string;
  
    @Column({ type: 'int', default: 60 })
    duration: number;
  
    @Column({
      name: 'lesson_type',
      type: 'enum',
      enum: ['individual', 'group'],
      default: 'individual',
    })
    lessonType: LessonType;
  
    @Column({
      type: 'enum',
      enum: ['online', 'offline'],
      default: 'online',
    })
    format: LessonFormat;
  
    @Column({
      type: 'enum',
      enum: ['open', 'booked', 'cancelled'],
      default: 'open',
    })
    status: SlotStatus;
  
    @Column({ name: 'recurring_group_id', type: 'uuid', nullable: true })
    recurringGroupId: string;
  
    @Column({ name: 'meeting_link', type: 'text', nullable: true })
    meetingLink: string;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }