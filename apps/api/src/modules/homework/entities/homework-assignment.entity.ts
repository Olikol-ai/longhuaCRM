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
import { HomeworkAssignmentStatus } from '../enums';
import { HomeworkEntity } from './homework.entity';
import { HomeworkAttemptEntity } from './homework-attempt.entity';

@Entity('homework_assignments')
export class HomeworkAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_ASSIGNMENTS_HOMEWORK')
  @Column({ name: 'homework_id', type: 'uuid' })
  homeworkId: string;

  @ManyToOne(() => HomeworkEntity, (h) => h.assignments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'homework_id' })
  homework?: HomeworkEntity;

  @Index('IDX_HOMEWORK_ASSIGNMENTS_STUDENT')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Index('IDX_HOMEWORK_ASSIGNMENTS_ASSIGNED_BY')
  @Column({ name: 'assigned_by_user_id', type: 'uuid' })
  assignedByUserId: string;

  @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
  lessonId: string | null;

  @Index('IDX_HOMEWORK_ASSIGNMENTS_STATUS')
  @Column({ type: 'varchar', length: 32, default: HomeworkAssignmentStatus.Assigned })
  status: HomeworkAssignmentStatus;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ name: 'assigned_at', type: 'timestamptz', default: () => 'NOW()' })
  assignedAt: Date;

  @OneToMany(() => HomeworkAttemptEntity, (a) => a.assignment)
  attempts?: HomeworkAttemptEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
