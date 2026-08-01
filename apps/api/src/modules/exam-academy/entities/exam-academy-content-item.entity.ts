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
import { ExamAcademyProgramEntity } from './exam-academy-program.entity';
import { ExamAcademyProgramVersionEntity } from './exam-academy-program-version.entity';
import { ExamAcademyLevelEntity } from './exam-academy-level.entity';
import { ExamAcademyContentVocabularyEntity } from './exam-academy-content-vocabulary.entity';
import { ExamAcademyContentGrammarEntity } from './exam-academy-content-grammar.entity';

@Entity('exam_academy_content_items')
export class ExamAcademyContentItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'content_kind', type: 'varchar', length: 32 })
  contentKind: string;

  @Index('IDX_EA_CONTENT_KIND_ID')
  @Column({ name: 'content_id', type: 'uuid' })
  contentId: string;

  @Column({ name: 'program_id', type: 'uuid' })
  programId: string;

  @ManyToOne(() => ExamAcademyProgramEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'program_id' })
  program?: ExamAcademyProgramEntity;

  @Column({ name: 'version_id', type: 'uuid' })
  versionId: string;

  @ManyToOne(() => ExamAcademyProgramVersionEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'version_id' })
  version?: ExamAcademyProgramVersionEntity;

  @Index('IDX_EA_CONTENT_LEVEL_SECTION')
  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => ExamAcademyLevelEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'level_id' })
  level?: ExamAcademyLevelEntity;

  @Column({ name: 'section_key', type: 'varchar', length: 64 })
  sectionKey: string;

  @Column({ name: 'item_type_code', type: 'varchar', length: 64 })
  itemTypeCode: string;

  @Column({ type: 'text', nullable: true })
  topic: string | null;

  @Column({ type: 'int', default: 1 })
  difficulty: number;

  @Column({ name: 'recommended_time_seconds', type: 'int', nullable: true })
  recommendedTimeSeconds: number | null;

  @Column({ name: 'author_user_id', type: 'uuid', nullable: true })
  authorUserId: string | null;

  @Index('IDX_EA_CONTENT_STATUS')
  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: string;

  @Column({ type: 'int', default: 1 })
  revision: number;

  @Column({ name: 'supersedes_item_id', type: 'uuid', nullable: true })
  supersedesItemId: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @OneToMany(() => ExamAcademyContentVocabularyEntity, (v) => v.contentItem)
  vocabulary?: ExamAcademyContentVocabularyEntity[];

  @OneToMany(() => ExamAcademyContentGrammarEntity, (g) => g.contentItem)
  grammar?: ExamAcademyContentGrammarEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
