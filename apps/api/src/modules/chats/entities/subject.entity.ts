import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserSubjectEntity } from './user-subject.entity';
import { CourseSubjectEntity } from './course-subject.entity';
import { TeacherSubjectEntity } from './teacher-subject.entity';
import { TutorSubjectEntity } from './tutor-subject.entity';
import { ChatEntity } from './chat.entity';

@Entity('subjects')
export class SubjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => UserSubjectEntity, (row) => row.subject)
  userSubjects?: UserSubjectEntity[];

  @OneToMany(() => CourseSubjectEntity, (row) => row.subject)
  courseSubjects?: CourseSubjectEntity[];

  @OneToMany(() => TeacherSubjectEntity, (row) => row.subject)
  teacherSubjects?: TeacherSubjectEntity[];

  @OneToMany(() => TutorSubjectEntity, (row) => row.subject)
  tutorSubjects?: TutorSubjectEntity[];

  @OneToMany(() => ChatEntity, (chat) => chat.subject)
  chats?: ChatEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
