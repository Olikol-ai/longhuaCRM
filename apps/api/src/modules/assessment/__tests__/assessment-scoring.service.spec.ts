import { AssessmentScoringService } from '../services/assessment-scoring.service';
import { EvaluationType, PassingMode, QuestionType } from '../enums';
import { AssessmentAttemptRepository } from '../repositories';

describe('AssessmentScoringService', () => {
  const attempts = {
    findQuestionSnapshotsByAttemptId: jest.fn(),
    findAttemptAnswersByAttemptId: jest.fn(),
    findSelectedAnswerSnapshotIds: jest.fn(),
    findAnswerSnapshotsByQuestionSnapshotId: jest.fn(),
  } as unknown as jest.Mocked<AssessmentAttemptRepository>;

  const scoring = new AssessmentScoringService(attempts);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scoreAutoQuestion', () => {
    it('scoring single choice — correct', () => {
      const result = scoring.scoreAutoQuestion(
        { type: QuestionType.SingleChoice },
        [
          { id: 'a1', isCorrect: true } as never,
          { id: 'a2', isCorrect: false } as never,
        ],
        ['a1'],
        5,
      );
      expect(result).toEqual({ earned: 5, isCorrect: true });
    });

    it('scoring wrong answers — single choice', () => {
      const result = scoring.scoreAutoQuestion(
        { type: QuestionType.SingleChoice },
        [
          { id: 'a1', isCorrect: true } as never,
          { id: 'a2', isCorrect: false } as never,
        ],
        ['a2'],
        5,
      );
      expect(result).toEqual({ earned: 0, isCorrect: false });
    });

    it('scoring multiple choice — exact match', () => {
      const result = scoring.scoreAutoQuestion(
        { type: QuestionType.MultipleChoice },
        [
          { id: 'a1', isCorrect: true } as never,
          { id: 'a2', isCorrect: true } as never,
          { id: 'a3', isCorrect: false } as never,
        ],
        ['a1', 'a2'],
        10,
      );
      expect(result).toEqual({ earned: 10, isCorrect: true });
    });

    it('scoring wrong answers — multiple choice partial', () => {
      const result = scoring.scoreAutoQuestion(
        { type: QuestionType.MultipleChoice },
        [
          { id: 'a1', isCorrect: true } as never,
          { id: 'a2', isCorrect: true } as never,
          { id: 'a3', isCorrect: false } as never,
        ],
        ['a1'],
        10,
      );
      expect(result).toEqual({ earned: 0, isCorrect: false });
    });

    it('scoring listening — correct single option', () => {
      const result = scoring.scoreAutoQuestion(
        { type: QuestionType.Listening },
        [
          { id: 'a1', isCorrect: true } as never,
          { id: 'a2', isCorrect: false } as never,
        ],
        ['a1'],
        3,
      );
      expect(result).toEqual({ earned: 3, isCorrect: true });
    });
  });

  describe('scoreAttempt', () => {
    it('short_text creates pending_review evaluation (manual/mixed)', async () => {
      attempts.findQuestionSnapshotsByAttemptId.mockResolvedValue([
        {
          id: 'qs-auto',
          sectionKey: 'main',
          type: QuestionType.SingleChoice,
          points: '1',
        },
        {
          id: 'qs-text',
          sectionKey: 'main',
          type: QuestionType.ShortText,
          points: '2',
        },
      ] as never);
      attempts.findAttemptAnswersByAttemptId.mockResolvedValue([
        { id: 'aa-1', questionSnapshotId: 'qs-auto', textAnswer: null },
        { id: 'aa-2', questionSnapshotId: 'qs-text', textAnswer: 'hello' },
      ] as never);
      attempts.findSelectedAnswerSnapshotIds
        .mockResolvedValueOnce(['a1'])
        .mockResolvedValueOnce([]);
      attempts.findAnswerSnapshotsByQuestionSnapshotId.mockResolvedValue([
        { id: 'a1', isCorrect: true },
      ] as never);

      const scored = await scoring.scoreAttempt(
        'att-1',
        new Map([['main', '1']]),
        { passingMode: PassingMode.Percent, passScorePercent: 50 },
      );

      expect(scored.evaluationType).toBe(EvaluationType.Mixed);
      expect(scored.requiresManualReview).toBe(true);
      expect(scored.score).toBe(1);
      expect(scored.maxScore).toBe(3);
      expect(scored.questions.find((q) => q.type === QuestionType.ShortText)?.requiresManualReview).toBe(
        true,
      );
    });

    it('all short_text → manual evaluation type', async () => {
      attempts.findQuestionSnapshotsByAttemptId.mockResolvedValue([
        {
          id: 'qs-text',
          sectionKey: 'main',
          type: QuestionType.ShortText,
          points: '2',
        },
      ] as never);
      attempts.findAttemptAnswersByAttemptId.mockResolvedValue([]);
      const scored = await scoring.scoreAttempt('att-1');
      expect(scored.evaluationType).toBe(EvaluationType.Manual);
      expect(scored.requiresManualReview).toBe(true);
    });
  });
});
