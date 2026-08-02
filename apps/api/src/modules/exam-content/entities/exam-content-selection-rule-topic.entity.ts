import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExamContentSelectionRuleEntity } from './exam-content-selection-rule.entity';

@Entity('exam_content_selection_rule_topics')
export class ExamContentSelectionRuleTopicEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'rule_id', type: 'uuid' }) ruleId: string;
  @ManyToOne(() => ExamContentSelectionRuleEntity, (r) => r.topicFilters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' }) rule?: ExamContentSelectionRuleEntity;
  @Column({ name: 'topic_id', type: 'uuid' }) topicId: string;
}
