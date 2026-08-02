import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  AssessmentAnswerSnapshotEntity,
  AssessmentAttemptAnswerEntity,
  AssessmentAttemptAnswerSelectionEntity,
  AssessmentAttemptEntity,
  AssessmentQuestionSnapshotEntity,
  AssessmentQuestionSnapshotVocabularyEntity,
} from '../entities';
import { AttemptStatus } from '../enums';

export type AssessmentAttemptSnapshotsBulkSaveResult = {
  questionSnapshots: AssessmentQuestionSnapshotEntity[];
  answerSnapshots: AssessmentAnswerSnapshotEntity[];
};

@Injectable()
export class AssessmentAttemptRepository {
  constructor(
    @InjectRepository(AssessmentAttemptEntity)
    private readonly attemptRepo: Repository<AssessmentAttemptEntity>,
    @InjectRepository(AssessmentQuestionSnapshotEntity)
    private readonly questionSnapshotRepo: Repository<AssessmentQuestionSnapshotEntity>,
    @InjectRepository(AssessmentAnswerSnapshotEntity)
    private readonly answerSnapshotRepo: Repository<AssessmentAnswerSnapshotEntity>,
    @InjectRepository(AssessmentQuestionSnapshotVocabularyEntity)
    private readonly vocabularySnapshotRepo: Repository<AssessmentQuestionSnapshotVocabularyEntity>,
    @InjectRepository(AssessmentAttemptAnswerEntity)
    private readonly attemptAnswerRepo: Repository<AssessmentAttemptAnswerEntity>,
    @InjectRepository(AssessmentAttemptAnswerSelectionEntity)
    private readonly attemptAnswerSelectionRepo: Repository<AssessmentAttemptAnswerSelectionEntity>,
  ) {}

  findAll(): Promise<AssessmentAttemptEntity[]> {
    return this.attemptRepo.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<AssessmentAttemptEntity | null> {
    return this.attemptRepo.findOne({ where: { id } });
  }

  filter(where: FindOptionsWhere<AssessmentAttemptEntity>): Promise<AssessmentAttemptEntity[]> {
    return this.attemptRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  filterByExamId(examId: string): Promise<AssessmentAttemptEntity[]> {
    return this.filter({ examId });
  }

  filterByUserId(userId: string): Promise<AssessmentAttemptEntity[]> {
    return this.filter({ userId });
  }

  save(entity: Partial<AssessmentAttemptEntity>): Promise<AssessmentAttemptEntity> {
    return this.attemptRepo.save(this.attemptRepo.create(entity));
  }

  async update(
    id: string,
    data: Partial<AssessmentAttemptEntity>,
  ): Promise<AssessmentAttemptEntity | null> {
    await this.attemptRepo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.attemptRepo.delete({ id });
  }

  countSnapshots(attemptId: string): Promise<number> {
    return this.questionSnapshotRepo.count({ where: { attemptId } });
  }

  countAttemptsForUserExam(userId: string, examId: string): Promise<number> {
    return this.attemptRepo.count({ where: { userId, examId } });
  }

  countAttemptsForUserExamByStatus(
    userId: string,
    examId: string,
    status: AttemptStatus,
  ): Promise<number> {
    return this.attemptRepo.count({ where: { userId, examId, status } });
  }

  /**
   * Started Attempts whose deadline has elapsed (timeout candidates).
   */
  findExpiredStartedAttempts(
    now: Date,
    limit = 100,
  ): Promise<AssessmentAttemptEntity[]> {
    return this.attemptRepo
      .createQueryBuilder('attempt')
      .where('attempt.status = :status', { status: AttemptStatus.Started })
      .andWhere('attempt.expires_at IS NOT NULL')
      .andWhere('attempt.expires_at <= :now', { now })
      .orderBy('attempt.expires_at', 'ASC')
      .take(limit)
      .getMany();
  }

  async saveSnapshotsInBulk(
    questionSnapshots: Partial<AssessmentQuestionSnapshotEntity>[],
    answerSnapshots: Partial<AssessmentAnswerSnapshotEntity>[],
  ): Promise<AssessmentAttemptSnapshotsBulkSaveResult> {
    return this.attemptRepo.manager.transaction(async (manager) => {
      const questionRepo = manager.getRepository(AssessmentQuestionSnapshotEntity);
      const answerRepo = manager.getRepository(AssessmentAnswerSnapshotEntity);

      const savedQuestionSnapshots =
        questionSnapshots.length === 0
          ? []
          : await questionRepo.save(
              questionSnapshots.map((snapshot) => questionRepo.create(snapshot)),
            );

      const savedAnswerSnapshots =
        answerSnapshots.length === 0
          ? []
          : await answerRepo.save(
              answerSnapshots.map((snapshot) => answerRepo.create(snapshot)),
            );

      return {
        questionSnapshots: savedQuestionSnapshots,
        answerSnapshots: savedAnswerSnapshots,
      };
    });
  }

  findQuestionSnapshotById(
    id: string,
  ): Promise<AssessmentQuestionSnapshotEntity | null> {
    return this.questionSnapshotRepo.findOne({ where: { id } });
  }

  findQuestionSnapshotsByAttemptId(
    attemptId: string,
  ): Promise<AssessmentQuestionSnapshotEntity[]> {
    return this.questionSnapshotRepo.find({
      where: { attemptId },
      relations: ['vocabulary'],
      order: { sortOrder: 'ASC' },
    });
  }

  async saveVocabularySnapshots(
    rows: Partial<AssessmentQuestionSnapshotVocabularyEntity>[],
  ): Promise<AssessmentQuestionSnapshotVocabularyEntity[]> {
    if (!rows.length) return [];
    return this.vocabularySnapshotRepo.save(
      rows.map((row) => this.vocabularySnapshotRepo.create(row)),
    );
  }

  findAnswerSnapshotsByQuestionSnapshotId(
    questionSnapshotId: string,
  ): Promise<AssessmentAnswerSnapshotEntity[]> {
    return this.answerSnapshotRepo.find({
      where: { questionSnapshotId },
      order: { sortOrder: 'ASC' },
    });
  }

  async findAnswerSnapshotsByAttemptId(
    attemptId: string,
  ): Promise<AssessmentAnswerSnapshotEntity[]> {
    const questionSnapshots = await this.findQuestionSnapshotsByAttemptId(attemptId);
    if (questionSnapshots.length === 0) {
      return [];
    }
    const questionSnapshotIds = questionSnapshots.map((row) => row.id);
    return this.answerSnapshotRepo
      .createQueryBuilder('answer')
      .where('answer.question_snapshot_id IN (:...questionSnapshotIds)', {
        questionSnapshotIds,
      })
      .orderBy('answer.sort_order', 'ASC')
      .getMany();
  }

  /**
   * True when the user has any Attempt whose Snapshot references this bank question.
   */
  async userHasSnapshotForSourceQuestion(
    userId: string,
    sourceQuestionId: string,
  ): Promise<boolean> {
    const count = await this.questionSnapshotRepo
      .createQueryBuilder('qs')
      .innerJoin('qs.attempt', 'attempt')
      .where('attempt.user_id = :userId', { userId })
      .andWhere('qs.source_question_id = :sourceQuestionId', { sourceQuestionId })
      .getCount();
    return count > 0;
  }

  findAttemptAnswersByAttemptId(attemptId: string): Promise<AssessmentAttemptAnswerEntity[]> {
    return this.attemptAnswerRepo.find({ where: { attemptId } });
  }

  /**
   * True when the learner saved at least one real answer (choice / text / audio).
   * Empty attempt_answer shells without content do not count.
   */
  async countEngagedAnswers(attemptId: string): Promise<number> {
    const raw = await this.attemptAnswerRepo
      .createQueryBuilder('a')
      .leftJoin('a.selections', 'sel')
      .where('a.attempt_id = :attemptId', { attemptId })
      .andWhere(
        `(
          (a.text_answer IS NOT NULL AND TRIM(a.text_answer) <> '')
          OR a.audio_storage_key IS NOT NULL
          OR sel.id IS NOT NULL
        )`,
      )
      .select('COUNT(DISTINCT a.id)', 'cnt')
      .getRawOne<{ cnt: string }>();
    return Number(raw?.cnt) || 0;
  }

  findAttemptAnswerById(id: string): Promise<AssessmentAttemptAnswerEntity | null> {
    return this.attemptAnswerRepo.findOne({ where: { id } });
  }

  saveAttemptAnswer(
    entity: Partial<AssessmentAttemptAnswerEntity>,
  ): Promise<AssessmentAttemptAnswerEntity> {
    return this.attemptAnswerRepo.save(this.attemptAnswerRepo.create(entity));
  }

  async updateAttemptAnswer(
    id: string,
    data: Partial<AssessmentAttemptAnswerEntity>,
  ): Promise<void> {
    await this.attemptAnswerRepo.update({ id }, data);
  }

  saveAttemptAnswerSelections(
    entities: Partial<AssessmentAttemptAnswerSelectionEntity>[],
  ): Promise<AssessmentAttemptAnswerSelectionEntity[]> {
    if (entities.length === 0) {
      return Promise.resolve([]);
    }
    return this.attemptAnswerSelectionRepo.save(
      entities.map((entity) => this.attemptAnswerSelectionRepo.create(entity)),
    );
  }

  async findSelectedAnswerSnapshotIds(attemptAnswerId: string): Promise<string[]> {
    const rows = await this.attemptAnswerSelectionRepo.find({
      where: { attemptAnswerId },
    });
    return rows.map((r) => r.answerSnapshotId);
  }

  async replaceSelectionsForAttemptAnswer(
    attemptAnswerId: string,
    answerSnapshotIds: string[],
  ): Promise<AssessmentAttemptAnswerSelectionEntity[]> {
    await this.attemptAnswerSelectionRepo.delete({ attemptAnswerId });
    return this.saveAttemptAnswerSelections(
      answerSnapshotIds.map((answerSnapshotId) => ({
        attemptAnswerId,
        answerSnapshotId,
      })),
    );
  }
}
