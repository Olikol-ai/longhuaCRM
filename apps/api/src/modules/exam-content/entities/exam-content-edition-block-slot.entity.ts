import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExamContentEditionBlockEntity } from './exam-content-edition-block.entity';
import { ExamContentSelectionRuleEntity } from './exam-content-selection-rule.entity';

@Entity('exam_content_edition_block_slots')
export class ExamContentEditionBlockSlotEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'block_id', type: 'uuid' }) blockId: string;
  @ManyToOne(() => ExamContentEditionBlockEntity, (b) => b.slots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'block_id' }) block?: ExamContentEditionBlockEntity;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder: number;
  @Column({ name: 'slot_kind', type: 'varchar', length: 32, default: 'rule' }) slotKind: string;
  @Column({ name: 'selection_rule_id', type: 'uuid', nullable: true }) selectionRuleId: string | null;
  @ManyToOne(() => ExamContentSelectionRuleEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'selection_rule_id' }) selectionRule?: ExamContentSelectionRuleEntity | null;
  @Column({ name: 'fixed_group_id', type: 'uuid', nullable: true }) fixedGroupId: string | null;
  @Column({ name: 'fixed_item_id', type: 'uuid', nullable: true }) fixedItemId: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
