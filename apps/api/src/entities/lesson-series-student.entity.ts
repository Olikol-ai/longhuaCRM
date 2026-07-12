import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lesson_series_students')
@Index('IDX_LESSON_SERIES_STUDENT_UNIQUE', ['seriesId', 'studentId'], { unique: true })
export class LessonSeriesStudentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_LESSON_SERIES_STUDENT_SERIES_ID')
  @Column({ name: 'series_id', type: 'uuid' })
  seriesId: string;

  @Index('IDX_LESSON_SERIES_STUDENT_STUDENT_ID')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
