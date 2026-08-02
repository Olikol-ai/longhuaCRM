import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExamContentItemVocabularyEntity } from './exam-content-item-vocabulary.entity';
import { ExamContentItemGrammarEntity } from './exam-content-item-grammar.entity';
import { ExamContentItemMediaEntity } from './exam-content-item-media.entity';
import { ExamContentLevelEntity } from './exam-content-level.entity';

@Entity('exam_content_items')
export class ExamContentItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'content_kind', type: 'varchar', length: 32, default: 'question' })
  contentKind: string;

  @Column({ name: 'engine_content_id', type: 'uuid' })
  engineContentId: string;

  @Column({ name: 'program_id', type: 'uuid' })
  programId: string;

  @Column({ name: 'version_id', type: 'uuid' })
  versionId: string;

  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => ExamContentLevelEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'level_id' })
  level?: ExamContentLevelEntity;

  @Column({ name: 'section_id', type: 'uuid', nullable: true })
  sectionId: string | null;

  @Column({ name: 'section_key', type: 'varchar', length: 64, default: 'reading' })
  sectionKey: string;

  @Column({ name: 'subsection_id', type: 'uuid', nullable: true })
  subsectionId: string | null;

  @Column({ name: 'topic_id', type: 'uuid', nullable: true })
  topicId: string | null;

  @Column({ name: 'subtopic_id', type: 'uuid', nullable: true })
  subtopicId: string | null;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @Column({ name: 'item_type_code', type: 'varchar', length: 64 })
  itemTypeCode: string;

  @Column({ type: 'text', nullable: true })
  topic: string | null;

  @Column({ type: 'int', default: 1 })
  difficulty: number;

  @Column({ name: 'recommended_time_seconds', type: 'int', nullable: true })
  recommendedTimeSeconds: number | null;

  @Column({ name: 'stem_search', type: 'text', nullable: true })
  stemSearch: string | null;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: string;

  @Column({ type: 'int', default: 1 })
  revision: number;

  @Column({ name: 'supersedes_item_id', type: 'uuid', nullable: true })
  supersedesItemId: string | null;

  @Column({ name: 'edition_family_id', type: 'uuid', nullable: true })
  editionFamilyId: string | null;

  @Column({ name: 'author_user_id', type: 'uuid', nullable: true })
  authorUserId: string | null;

  @Column({ name: 'editor_user_id', type: 'uuid', nullable: true })
  editorUserId: string | null;

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'external_id', type: 'varchar', length: 128, nullable: true })
  externalId: string | null;

  @OneToMany(() => ExamContentItemVocabularyEntity, (v) => v.item)
  vocabulary?: ExamContentItemVocabularyEntity[];

  @OneToMany(() => ExamContentItemGrammarEntity, (g) => g.item)
  grammar?: ExamContentItemGrammarEntity[];

  @OneToMany(() => ExamContentItemMediaEntity, (m) => m.item)
  media?: ExamContentItemMediaEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
