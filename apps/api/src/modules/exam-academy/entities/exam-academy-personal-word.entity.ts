import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('exam_academy_personal_words')
export class ExamAcademyPersonalWordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_EA_PERSONAL_WORDS_USER')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  word: string;

  @Column({ type: 'text', nullable: true })
  pinyin: string | null;

  @Column({ type: 'text', nullable: true })
  translation: string | null;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'source_content_kind', type: 'varchar', length: 32, nullable: true })
  sourceContentKind: string | null;

  @Column({ name: 'source_content_id', type: 'uuid', nullable: true })
  sourceContentId: string | null;

  @Column({ type: 'varchar', length: 32, default: 'saved' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
