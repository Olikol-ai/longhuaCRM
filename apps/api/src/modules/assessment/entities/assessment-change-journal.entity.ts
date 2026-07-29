import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Assessment authoring change journal.
 * old_version / new_version are text snapshots (not JSONB).
 */
@Entity('assessment_change_journal')
export class AssessmentChangeJournalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_CHANGE_JOURNAL_ACTOR')
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Index('IDX_ASSESSMENT_CHANGE_JOURNAL_ENTITY')
  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 128 })
  entityId: string;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ name: 'old_version', type: 'text', nullable: true })
  oldVersion: string | null;

  @Column({ name: 'new_version', type: 'text', nullable: true })
  newVersion: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
