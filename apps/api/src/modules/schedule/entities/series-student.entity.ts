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
import { LessonSeriesEntity } from '../../lesson-series/entities/lesson-series.entity';
import { StudentEntity } from '../../students/entities/student.entity';

@Entity('lesson_series_students')
@Index('IDX_SERIES_STUDENT_UNIQUE', ['seriesId', 'studentId'], { unique: true })
export class SeriesStudentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_SERIES_STUDENT_SERIES_ID')
  @Column({ name: 'series_id', type: 'uuid' })
  seriesId: string;

  @ManyToOne(() => LessonSeriesEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'series_id' })
  series?: LessonSeriesEntity;

  @Index('IDX_SERIES_STUDENT_STUDENT_ID')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => StudentEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
