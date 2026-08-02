import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExamContentSelectionRuleEntity } from './exam-content-selection-rule.entity';

@Entity('exam_content_selection_rule_types')
export class ExamContentSelectionRuleTypeEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'rule_id', type: 'uuid' }) ruleId: string;
  @ManyToOne(() => ExamContentSelectionRuleEntity, (r) => r.typeFilters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' }) rule?: ExamContentSelectionRuleEntity;
  @Column({ name: 'item_type_code', type: 'varchar', length: 64 }) itemTypeCode: string;
}
