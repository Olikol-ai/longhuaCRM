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
import { CourseTemplateEntity } from '../../courses/entities/course-template.entity';
import { MaterialEntity } from './material.entity';
import { GrantedByRole } from './material-access.entity';

@Entity('material_course_grants')
@Index('UQ_material_course_grants_course_material', ['courseTemplateId', 'materialId'], {
  unique: true,
})
export class MaterialCourseGrantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_material_course_grants_course')
  @Column({ name: 'course_template_id', type: 'uuid' })
  courseTemplateId: string;

  @ManyToOne(() => CourseTemplateEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_template_id' })
  courseTemplate?: CourseTemplateEntity;

  @Index('IDX_material_course_grants_material')
  @Column({ name: 'material_id', type: 'uuid' })
  materialId: string;

  @ManyToOne(() => MaterialEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material?: MaterialEntity;

  @Column({ name: 'granted_by_role', type: 'varchar', length: 16, default: 'ADMIN' })
  grantedByRole: GrantedByRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
