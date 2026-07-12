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
import { StudentEntity } from '../../students/entities/student.entity';

export type CertificateStatus = 'draft' | 'issued' | 'sent' | 'duplicate' | 'revoked';

@Entity('certificates')
export class CertificateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_CERTIFICATE_STUDENT_ID')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => StudentEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentEntity;

  @Index('IDX_CERTIFICATE_COURSE_ID')
  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @ManyToOne(() => CourseTemplateEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_id' })
  course?: CourseTemplateEntity;

  @Index('IDX_CERTIFICATE_REGISTRATION_NUMBER', { unique: true })
  @Column({ name: 'registration_number', type: 'text' })
  registrationNumber: string;

  @Column({ name: 'blank_series', type: 'text', nullable: true })
  blankSeries: string | null;

  @Column({ name: 'blank_number', type: 'text', nullable: true })
  blankNumber: string | null;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate: string | null;

  @Column({
    type: 'enum',
    enum: ['draft', 'issued', 'sent', 'duplicate', 'revoked'],
    default: 'draft',
  })
  status: CertificateStatus;

  @Column({ name: 'recipient_signature', type: 'text', nullable: true })
  recipientSignature: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
