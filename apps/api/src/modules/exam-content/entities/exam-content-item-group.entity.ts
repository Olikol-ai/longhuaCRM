import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExamContentGroupItemEntity } from './exam-content-group-item.entity';
import { ExamContentGroupMediaEntity } from './exam-content-group-media.entity';

@Entity('exam_content_item_groups')
export class ExamContentItemGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'program_id', type: 'uuid' })
  programId: string;

  @Column({ name: 'version_id', type: 'uuid' })
  versionId: string;

  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @Column({ name: 'section_id', type: 'uuid', nullable: true })
  sectionId: string | null;

  @Column({ name: 'subsection_id', type: 'uuid', nullable: true })
  subsectionId: string | null;

  @Column({ name: 'topic_id', type: 'uuid', nullable: true })
  topicId: string | null;

  @Column({ name: 'subtopic_id', type: 'uuid', nullable: true })
  subtopicId: string | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'passage_text', type: 'text', nullable: true })
  passageText: string | null;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: string;

  @Column({ type: 'int', default: 1 })
  revision: number;

  @Column({ name: 'supersedes_group_id', type: 'uuid', nullable: true })
  supersedesGroupId: string | null;

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

  @OneToMany(() => ExamContentGroupItemEntity, (gi) => gi.group)
  groupItems?: ExamContentGroupItemEntity[];

  @OneToMany(() => ExamContentGroupMediaEntity, (m) => m.group)
  media?: ExamContentGroupMediaEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
