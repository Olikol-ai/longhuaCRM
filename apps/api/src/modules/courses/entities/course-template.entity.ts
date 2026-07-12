import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CourseTemplateType = 'basic_beginner' | 'advanced_beginner' | 'advanced';

@Entity('course_templates')
export class CourseTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({
    name: 'course_type',
    type: 'enum',
    enum: ['basic_beginner', 'advanced_beginner', 'advanced'],
  })
  courseType: CourseTemplateType;

  @Column({ name: 'total_lessons', type: 'int', default: 35 })
  totalLessons: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  price: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
