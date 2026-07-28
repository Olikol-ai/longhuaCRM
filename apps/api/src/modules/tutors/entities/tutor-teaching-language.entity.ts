import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TutorEntity } from './tutor.entity';

@Entity('tutor_teaching_languages')
export class TutorTeachingLanguageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TUTOR_TEACHING_LANGUAGES_TUTOR_ID')
  @Column({ name: 'tutor_id', type: 'uuid' })
  tutorId: string;

  @ManyToOne(() => TutorEntity, (tutor) => tutor.teachingLanguages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tutor_id' })
  tutor?: TutorEntity;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
