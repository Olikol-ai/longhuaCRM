import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  export type AttendanceStatus =
    | 'enrolled'
    | 'attended'
    | 'missed'
    | 'missed_no_notice'
    | 'cancelled';
  
  @Entity('lesson_students')
  export class LessonStudentEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index('IDX_LESSON_STUDENT_LESSON_ID')
    @Column({ name: 'lesson_id', type: 'uuid' })
    lessonId: string;
  
    @Index('IDX_LESSON_STUDENT_STUDENT_ID')
    @Column({ name: 'student_id', type: 'uuid' })
    studentId: string;
  
    @Column({
      name: 'attendance_status',
      type: 'enum',
      enum: ['enrolled', 'attended', 'missed', 'missed_no_notice', 'cancelled'],
      default: 'enrolled',
    })
    attendanceStatus: AttendanceStatus;
  
    @Column({
      name: 'balance_deducted',
      type: 'boolean',
      default: false,
    })
    balanceDeducted: boolean;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }