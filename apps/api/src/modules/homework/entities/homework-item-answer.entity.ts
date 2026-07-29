import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HomeworkItemEntity } from './homework-item.entity';

@Entity('homework_item_answers')
export class HomeworkItemAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_ITEM_ANSWERS_ITEM')
  @Column({ name: 'homework_item_id', type: 'uuid' })
  homeworkItemId: string;

  @ManyToOne(() => HomeworkItemEntity, (item) => item.answers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'homework_item_id' })
  item?: HomeworkItemEntity;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'is_correct', type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
