import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentQuestionEntity } from './assessment-question.entity';
import { AssessmentTopicEntity } from './assessment-topic.entity';

@Entity('assessment_question_topics')
@Index('UQ_ASSESSMENT_QUESTION_TOPICS', ['questionId', 'topicId'], { unique: true })
export class AssessmentQuestionTopicEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_QUESTION_TOPICS_QUESTION')
  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @ManyToOne(() => AssessmentQuestionEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question?: AssessmentQuestionEntity;

  @Index('IDX_ASSESSMENT_QUESTION_TOPICS_TOPIC')
  @Column({ name: 'topic_id', type: 'uuid' })
  topicId: string;

  @ManyToOne(() => AssessmentTopicEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic?: AssessmentTopicEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
