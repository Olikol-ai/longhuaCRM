import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  export type LessonStatus =
    | 'planned'
    | 'completed'
    | 'cancelled'
    | 'rescheduled'
    | 'missed'
    | 'missed_no_notice';
  
  export type LessonFormat = 'online' | 'offline';
  export type LessonType = 'individual' | 'group';
  
  @Entity('lessons')
  export class LessonEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index('IDX_LESSON_SCHEDULE_SLOT_ID')
    @Column({ name: 'schedule_slot_id', type: 'uuid', nullable: true })
    scheduleSlotId: string;
  
    @Index('IDX_LESSON_TEACHER_ID')
    @Column({ name: 'teacher_id', type: 'uuid' })
    teacherId: string;
  
    @Column({ name: 'teacher_name', type: 'text', nullable: true })
    teacherName: string;
  
    @Column({ name: 'teacher_first_name', type: 'text', nullable: true })
    teacherFirstName: string;
  
    @Column({ name: 'teacher_last_name', type: 'text', nullable: true })
    teacherLastName: string;
  
    @Index('IDX_LESSON_PRIMARY_STUDENT_ID')
    @Column({ name: 'student_id', type: 'uuid', nullable: true })
    studentId: string;
  
    @Column({ name: 'student_name', type: 'text', nullable: true })
    studentName: string;
  
    @Column({ name: 'student_first_name', type: 'text', nullable: true })
    studentFirstName: string;
  
    @Column({ name: 'student_last_name', type: 'text', nullable: true })
    studentLastName: string;
  
    @Column({ type: 'date' })
    date: string;
  
    @Column({ name: 'start_time', type: 'time' })
    startTime: string;
  
    @Column({ type: 'int', default: 60 })
    duration: number;
  
    @Column({ name: 'meeting_link', type: 'text', nullable: true })
    meetingLink: string;
  
    @Column({
      type: 'enum',
      enum: [
        'planned',
        'completed',
        'cancelled',
        'rescheduled',
        'missed',
        'missed_no_notice',
      ],
      default: 'planned',
    })
    status: LessonStatus;
  
    @Column({
      name: 'lesson_format',
      type: 'enum',
      enum: ['online', 'offline'],
      default: 'online',
    })
    lessonFormat: LessonFormat;
  
    @Column({
      name: 'lesson_type',
      type: 'enum',
      enum: ['individual', 'group'],
      default: 'individual',
    })
    lessonType: LessonType;
  
    @Column({ name: 'lesson_topic', type: 'text', nullable: true })
    lessonTopic: string;
  
    @Column({ type: 'text', nullable: true })
    notes: string;
  
    @Column({ name: 'is_recurring', type: 'boolean', default: false })
    isRecurring: boolean;
  
    @Column({ name: 'recurring_group_id', type: 'uuid', nullable: true })
    recurringGroupId: string;

    @Index('IDX_LESSON_RECURRENCE_SERIES_ID')
    @Column({ name: 'recurrence_series_id', type: 'uuid', nullable: true })
    recurrenceSeriesId: string | null;

    @Column({ name: 'recurrence_index', type: 'int', nullable: true })
    recurrenceIndex: number | null;

    @Column({ name: 'manually_modified', type: 'boolean', default: false })
    manuallyModified: boolean;

    @Column({ name: 'balance_deducted', type: 'boolean', default: false })
    balanceDeducted: boolean;
  
    @Column({ name: 'teacher_payment_id', type: 'uuid', nullable: true })
    teacherPaymentId: string;
  
    @Column({ name: 'reminder_24h_sent', type: 'boolean', default: false })
    reminder24hSent: boolean;
  
    @Column({ name: 'reminder_2h_sent', type: 'boolean', default: false })
    reminder2hSent: boolean;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }