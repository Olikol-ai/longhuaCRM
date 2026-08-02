import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ExamContentSelectionRuleTypeEntity } from './exam-content-selection-rule-type.entity';
import { ExamContentSelectionRuleTopicEntity } from './exam-content-selection-rule-topic.entity';

@Entity('exam_content_selection_rules')
export class ExamContentSelectionRuleEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'select_count', type: 'int', default: 1 }) selectCount: number;
  @Column({ name: 'select_group_count', type: 'int', nullable: true }) selectGroupCount: number | null;
  @Column({ name: 'selection_mode', type: 'varchar', length: 32, default: 'random' }) selectionMode: string;
  @Column({ name: 'difficulty_min', type: 'int', default: 1 }) difficultyMin: number;
  @Column({ name: 'difficulty_max', type: 'int', default: 5 }) difficultyMax: number;
  @Column({ name: 'subsection_id', type: 'uuid', nullable: true }) subsectionId: string | null;
  @Column({ name: 'exclude_recent_days', type: 'int', default: 30 }) excludeRecentDays: number;
  @Column({ name: 'deny_duplicate_media', type: 'boolean', default: true }) denyDuplicateMedia: boolean;
  @Column({ name: 'allow_reuse_if_pool_short', type: 'boolean', default: false }) allowReuseIfPoolShort: boolean;
  @Column({ name: 'max_topic_share_percent', type: 'numeric', precision: 5, scale: 2, nullable: true }) maxTopicSharePercent: string | null;
  @Column({ name: 'min_mid_difficulty_share_percent', type: 'numeric', precision: 5, scale: 2, nullable: true }) minMidDifficultySharePercent: string | null;
  @Column({ name: 'balance_by', type: 'varchar', length: 32, default: 'topic' }) balanceBy: string;
  @OneToMany(() => ExamContentSelectionRuleTypeEntity, (t) => t.rule) typeFilters?: ExamContentSelectionRuleTypeEntity[];
  @OneToMany(() => ExamContentSelectionRuleTopicEntity, (t) => t.rule) topicFilters?: ExamContentSelectionRuleTopicEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
