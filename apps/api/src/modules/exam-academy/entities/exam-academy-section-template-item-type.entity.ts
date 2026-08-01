import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExamAcademySectionTemplateEntity } from './exam-academy-section-template.entity';
import { ExamAcademyItemTypeEntity } from './exam-academy-item-type.entity';

@Entity('exam_academy_section_template_item_types')
@Index('UQ_EA_SECTION_ITEM_TYPE', ['sectionTemplateId', 'itemTypeCode'], { unique: true })
export class ExamAcademySectionTemplateItemTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'section_template_id', type: 'uuid' })
  sectionTemplateId: string;

  @ManyToOne(() => ExamAcademySectionTemplateEntity, (s) => s.itemTypes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_template_id' })
  sectionTemplate?: ExamAcademySectionTemplateEntity;

  @Column({ name: 'item_type_code', type: 'varchar', length: 64 })
  itemTypeCode: string;

  @ManyToOne(() => ExamAcademyItemTypeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_type_code', referencedColumnName: 'code' })
  itemType?: ExamAcademyItemTypeEntity;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
